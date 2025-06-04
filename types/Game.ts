export interface IGame {
  id: number;
  image: string;
  name: string;
  year: number;
  link: string;
  description?: string; // Added this line
  irlInstructions?: { title: string; url: string }[];
  codeUrl?: string;
  authorUsername?: string;
}