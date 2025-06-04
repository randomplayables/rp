import { Octokit } from "@octokit/rest";
import RepoCacheModel from "@/models/RepoCache"; // Assuming you might want to cache this too
import { connectToDatabase } from "@/lib/mongodb";
import GitHubIntegrationModel from "@/models/GitHubIntegration"; // To get githubUsername

// Initialize the Octokit instance with token
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN // This token needs read access to randomplayables/rp
});

// Define return type for rate limit function
interface RateLimit {
  limit: number;
  remaining: number;
  reset: number;
}

interface UserRepoActivity {
  commits: number;
  linesChanged: number;
}

/**
 * Fetches the number of commits and total lines changed by a specific GitHub user in a given repository.
 * @param owner The owner of the repository.
 * @param repo The name of the repository.
 * @param githubUsername The GitHub username of the contributor.
 * @returns An object with commit count and total lines changed, or null if an error occurs.
 */
export async function fetchUserRepoActivity(owner: string, repo: string, githubUsername: string): Promise<UserRepoActivity | null> {
  console.log(`Fetching GitHub activity for ${githubUsername} in ${owner}/${repo}`);
  let commitCount = 0;
  let totalLinesChanged = 0;

  try {
    // Ensure DB connection for potential caching or other operations if extended
    await connectToDatabase();

    // Note: @octokit/rest doesn't have the same paginate.iterator method as the meta package
    // We'll implement pagination manually
    let page = 1;
    const perPage = 100;
    let hasMoreCommits = true;

    while (hasMoreCommits) {
      const commitsResponse = await octokit.rest.repos.listCommits({
        owner,
        repo,
        author: githubUsername,
        per_page: perPage,
        page: page,
      });

      const commitsData = commitsResponse.data;
      
      if (commitsData.length === 0) {
        hasMoreCommits = false;
        break;
      }

      commitCount += commitsData.length;
      
      for (const commitMeta of commitsData) {
        try {
          const { data: commitDetails } = await octokit.rest.repos.getCommit({
            owner,
            repo,
            ref: commitMeta.sha,
          });
          if (commitDetails.stats) {
            totalLinesChanged += commitDetails.stats.total || 0;
          }
        } catch (commitDetailError) {
          console.error(`Error fetching details for commit ${commitMeta.sha}:`, commitDetailError);
          // Continue to next commit if one fails
        }
      }

      // If we got fewer commits than perPage, we've reached the end
      if (commitsData.length < perPage) {
        hasMoreCommits = false;
      } else {
        page++;
      }
    }

    console.log(`Activity for ${githubUsername} in ${owner}/${repo}: ${commitCount} commits, ${totalLinesChanged} lines changed.`);
    return { commits: commitCount, linesChanged: totalLinesChanged };

  } catch (error) {
    console.error(`Error fetching repository activity for user ${githubUsername} in ${owner}/${repo}:`, error);
    return null; // Return null or specific error object as needed
  }
}

// Define a generic type for fetched content
type RepoContent = string | Array<{name: string; path: string; content: string}> | null;

// Fetch repository content with caching
export async function fetchRepoContent(owner: string, repo: string, path: string = ""): Promise<RepoContent> {
  try {
    await connectToDatabase();
    
    const cached = await RepoCacheModel.findOne({ owner, repo, path });
    
    if (cached && (Date.now() - cached.lastUpdated.getTime() < 24 * 60 * 60 * 1000)) {
      console.log(`Using cached content for ${owner}/${repo}/${path}`);
      return cached.content;
    }
    
    console.log(`Fetching content from GitHub for ${owner}/${repo}/${path}`);
    
    const response = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
    });
    
    let result: RepoContent = null;
    
    if (Array.isArray(response.data)) {
      const contents: Array<{name: string; path: string; content: string}> = [];
      for (const item of response.data) {
        if (item.type === "file" && 
            (item.name.endsWith('.js') || 
             item.name.endsWith('.ts') || 
             item.name.endsWith('.tsx') || 
             item.name.endsWith('.jsx') ||
             item.name.endsWith('.html') ||
             item.name.endsWith('.css'))) {
          try {
            const fileContent = await fetchRepoContent(owner, repo, item.path);
            if (typeof fileContent === 'string') {
              contents.push({
                name: item.name,
                path: item.path,
                content: fileContent
              });
            }
          } catch (err) {
            console.error(`Error fetching ${item.path}:`, err);
          }
        }
      }
      result = contents;
    } else {
      if ('content' in response.data && 'encoding' in response.data) {
        const file = response.data;
        if (file.content && file.encoding === 'base64') {
          result = Buffer.from(file.content, 'base64').toString('utf8');
        }
      }
    }
    
    if (cached) {
      await RepoCacheModel.updateOne(
        { owner, repo, path },
        { content: result, lastUpdated: new Date() }
      );
    } else {
      await RepoCacheModel.create({
        owner,
        repo, 
        path,
        content: result,
        lastUpdated: new Date()
      });
    }
    
    return result;
  } catch (error) {
    console.error(`Error fetching repo content for ${owner}/${repo}/${path}:`, error);
    const cached = await RepoCacheModel.findOne({ owner, repo, path });
    if (cached) return cached.content;
    return null;
  }
}

interface RepoStructure {
  repo: string;
  description: string | null;
  defaultBranch: string;
  files: string[];
}

export async function getRepoStructure(owner: string, repo: string): Promise<RepoStructure | null> {
  try {
    await connectToDatabase();
    const cached = await RepoCacheModel.findOne({ owner, repo, path: 'structure' });
    
    if (cached && (Date.now() - cached.lastUpdated.getTime() < 24 * 60 * 60 * 1000)) {
      console.log(`Using cached structure for ${owner}/${repo}`);
      return cached.content as RepoStructure;
    }
    
    console.log(`Fetching repository structure for ${owner}/${repo}`);
    
    const { data: repoData } = await octokit.rest.repos.get({
      owner,
      repo
    });
    
    const defaultBranch = repoData.default_branch;
    
    const { data: treeData } = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: defaultBranch,
      recursive: '1'
    });
    
    const relevantFiles = treeData.tree
      .filter(item => 
        item.type === 'blob' && 
        (item.path?.endsWith('.js') || 
         item.path?.endsWith('.ts') || 
         item.path?.endsWith('.tsx') || 
         item.path?.endsWith('.jsx') ||
         item.path?.endsWith('.html') ||
         item.path?.endsWith('.css')));
    
    const structure: RepoStructure = {
      repo: repoData.name,
      description: repoData.description,
      defaultBranch,
      files: relevantFiles.map(file => file.path).filter((path): path is string => !!path)
    };
    
    if (cached) {
      await RepoCacheModel.updateOne(
        { owner, repo, path: 'structure' },
        { content: structure, lastUpdated: new Date() }
      );
    } else {
      await RepoCacheModel.create({
        owner,
        repo, 
        path: 'structure',
        content: structure,
        lastUpdated: new Date()
      });
    }
    
    return structure;
  } catch (error) {
    console.error(`Error fetching repo structure for ${owner}/${repo}:`, error);
    const cached = await RepoCacheModel.findOne({ owner, repo, path: 'structure' });
    if (cached) return cached.content as RepoStructure;
    return null;
  }
}

interface RepoInfo {
  owner: string | null;
  repo: string | null;
}

export function extractRepoInfo(url: string): RepoInfo {
  if (!url || !url.includes('github.com')) {
    return { owner: null, repo: null };
  }
  
  try {
    const urlParts = url.split('/');
    const repoIndex = urlParts.indexOf('github.com');
    
    if (repoIndex !== -1 && urlParts.length >= repoIndex + 3) {
      const owner = urlParts[repoIndex + 1];
      const repo = urlParts[repoIndex + 2].replace(/\.git$/, ''); // Remove .git if present
      return { owner, repo };
    }
  } catch (error) {
    console.error('Error extracting repo info:', error);
  }
  
  return { owner: null, repo: null };
}

interface GameCodeResult {
  game: {
    id: number;
    name: string;
  };
  repo: {
    owner: string;
    name: string;
    url: string;
  };
  structure: RepoStructure | null;
  packageJson: any;
  components: Array<{name: string; path: string; content: string}>;
  services: Array<{name: string; path: string; content: string}>;
  types: Array<{name: string; path: string; content: string}>;
}

export async function getGameCode(game: any): Promise<GameCodeResult | null> {
  if (!game?.codeUrl || !game.codeUrl.includes('github.com')) {
    console.log(`No GitHub URL found in codeUrl for game ${game?.name || 'unknown'}`);
    return null;
  }
  
  const { owner, repo } = extractRepoInfo(game.codeUrl);
  
  if (!owner || !repo) {
    console.log(`Failed to extract owner/repo from codeUrl: ${game.codeUrl}`);
    return null;
  }
  
  console.log(`Getting code for ${owner}/${repo} from game ${game.name}`);
  
  const structure = await getRepoStructure(owner, repo);
  const packageJsonContent = await fetchRepoContent(owner, repo, 'package.json');
  let packageJson = null;
  if (typeof packageJsonContent === 'string') {
    try {
      packageJson = JSON.parse(packageJsonContent);
    } catch (e) {
      console.error("Failed to parse package.json", e);
    }
  }
  
  const componentsResult = await fetchRepoContent(owner, repo, 'src/components');
  const components = Array.isArray(componentsResult) ? componentsResult : [];
  
  const servicesResult = await fetchRepoContent(owner, repo, 'src/services');
  const services = Array.isArray(servicesResult) ? servicesResult : [];
  
  const typesResult = await fetchRepoContent(owner, repo, 'src/types');
  const types = Array.isArray(typesResult) ? typesResult : [];
  
  return {
    game: {
      id: game.id,
      name: game.name,
    },
    repo: {
      owner,
      name: repo,
      url: `https://github.com/${owner}/${repo}`
    },
    structure,
    packageJson,
    components,
    services,
    types
  };
}