export interface BlogTag {
  tag: {
    id: number;
    name: string;
    slug: string;
  };
}

export interface Blog {
  id: number;
  title: string;
  content: string;
  author: string;
  publishDate?: string;
  status: string;
  coverImage?: string;
  views: number;
  userId: string;
  tags: BlogTag[];
  user?: {
    id: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    image?: string;
  };
}
