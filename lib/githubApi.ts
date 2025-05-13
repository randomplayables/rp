import { Octokit } from "octokit";
import RepoCacheModel from "@/models/RepoCache";
import { connectToDatabase } from "@/lib/mongodb";

// Initialize the Octokit instance with token
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

// Define return type for rate limit function
interface RateLimit {
  limit: number;
  remaining: number;
  reset: number;
}

// Check the remaining rate limit for debugging
export async function checkRateLimit(): Promise<RateLimit | null> {
  try {
    const { data } = await octokit.rest.rateLimit.get();
    console.log('GitHub API Rate Limit:', {
      limit: data.rate.limit,
      remaining: data.rate.remaining,
      reset: new Date(data.rate.reset * 1000).toLocaleTimeString()
    });
    return data.rate;
  } catch (error) {
    console.error('Error checking rate limit:', error);
    return null;
  }
}

// Define a generic type for fetched content
type RepoContent = string | Array<{name: string; path: string; content: string}> | null;

// Fetch repository content with caching
export async function fetchRepoContent(owner: string, repo: string, path: string = ""): Promise<RepoContent> {
  try {
    await connectToDatabase();
    
    // Check cache first
    const cached = await RepoCacheModel.findOne({ owner, repo, path });
    
    // If cache is recent (less than 1 day old), use it
    if (cached && (Date.now() - cached.lastUpdated.getTime() < 24 * 60 * 60 * 1000)) {
      console.log(`Using cached content for ${owner}/${repo}/${path}`);
      return cached.content;
    }
    
    console.log(`Fetching content from GitHub for ${owner}/${repo}/${path}`);
    
    // Fetch from GitHub
    const response = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
    });
    
    let result: RepoContent = null;
    
    // Handle directory vs file
    if (Array.isArray(response.data)) {
      // This is a directory, process each item
      const contents: Array<{name: string; path: string; content: string}> = [];
      for (const item of response.data) {
        if (item.type === "file" && 
            // Filter to relevant file types
            (item.name.endsWith('.js') || 
             item.name.endsWith('.ts') || 
             item.name.endsWith('.tsx') || 
             item.name.endsWith('.jsx') ||
             item.name.endsWith('.html') ||
             item.name.endsWith('.css'))) {
          try {
            // Fetch the file content
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
      // This is a file or symlink, check for content property
      // Use type assertion with check to safely access properties
      if ('content' in response.data && 'encoding' in response.data) {
        const file = response.data;
        if (file.content && file.encoding === 'base64') {
          result = Buffer.from(file.content, 'base64').toString('utf8');
        }
      }
    }
    
    // Update cache
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
    // If there's an error but we have cached content, return that
    const cached = await RepoCacheModel.findOne({ owner, repo, path });
    if (cached) return cached.content;
    return null;
  }
}

// Define type for repository structure
interface RepoStructure {
  repo: string;
  description: string | null;
  defaultBranch: string;
  files: string[];
}

// Get repository structure
export async function getRepoStructure(owner: string, repo: string): Promise<RepoStructure | null> {
  try {
    // First check if we have a cached structure
    await connectToDatabase();
    const cached = await RepoCacheModel.findOne({ owner, repo, path: 'structure' });
    
    if (cached && (Date.now() - cached.lastUpdated.getTime() < 24 * 60 * 60 * 1000)) {
      console.log(`Using cached structure for ${owner}/${repo}`);
      return cached.content as RepoStructure;
    }
    
    console.log(`Fetching repository structure for ${owner}/${repo}`);
    
    // Get the default branch
    const { data: repoData } = await octokit.rest.repos.get({
      owner,
      repo
    });
    
    const defaultBranch = repoData.default_branch;
    
    // Get the tree of the default branch
    const { data: treeData } = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: defaultBranch,
      recursive: '1'
    });
    
    // Filter to relevant files
    const relevantFiles = treeData.tree
      .filter(item => 
        item.type === 'blob' && 
        (item.path.endsWith('.js') || 
         item.path.endsWith('.ts') || 
         item.path.endsWith('.tsx') || 
         item.path.endsWith('.jsx') ||
         item.path.endsWith('.html') ||
         item.path.endsWith('.css')));
    
    const structure: RepoStructure = {
      repo: repoData.name,
      description: repoData.description,
      defaultBranch,
      files: relevantFiles.map(file => file.path)
    };
    
    // Update cache
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

// Type for repo info return value
interface RepoInfo {
  owner: string | null;
  repo: string | null;
}

// Extract repo owner and name from GitHub URL
export function extractRepoInfo(url: string): RepoInfo {
  if (!url || !url.includes('github.com')) {
    return { owner: null, repo: null };
  }
  
  try {
    const urlParts = url.split('/');
    const repoIndex = urlParts.indexOf('github.com');
    
    if (repoIndex !== -1 && urlParts.length >= repoIndex + 3) {
      const owner = urlParts[repoIndex + 1];
      const repo = urlParts[repoIndex + 2];
      return { owner, repo };
    }
  } catch (error) {
    console.error('Error extracting repo info:', error);
  }
  
  return { owner: null, repo: null };
}

// Type for game code return value
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

// Main function to get game code from a game
export async function getGameCode(game: any): Promise<GameCodeResult | null> {
  if (!game?.irlInstructions || !Array.isArray(game.irlInstructions)) {
    return null;
  }
  
  for (const instruction of game.irlInstructions) {
    if (instruction.url && instruction.url.includes('github.com')) {
      const { owner, repo } = extractRepoInfo(instruction.url);
      
      if (owner && repo) {
        // Get repository structure
        const structure = await getRepoStructure(owner, repo);
        
        // Fetch specific important files
        const packageJson = await fetchRepoContent(owner, repo, 'package.json');
        
        // Get some component examples
        const componentsResult = await fetchRepoContent(owner, repo, 'src/components');
        const components = Array.isArray(componentsResult) ? componentsResult : [];
        
        // Get services for API integration
        const servicesResult = await fetchRepoContent(owner, repo, 'src/services');
        const services = Array.isArray(servicesResult) ? servicesResult : [];
        
        // Get type definitions
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
    }
  }
  
  return null;
}