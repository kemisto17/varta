export type Post = {
  id: string;

  author: {
    id: string;
    name: string;
    branch: string;
    year: number;
    avatarUrl?: string;
  };

  content: string;
  imageUrl?: string;

  likeCount: number;
  commentCount: number;

  createdAt: string;
};