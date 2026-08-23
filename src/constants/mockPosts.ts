import { Post } from '../types/post';

export const mockPosts: Post[] = [
  {
    id: '1',

    author: {
      id: 'user-1',
      name: 'Aarav Mehta',
      branch: 'CSE',
      year: 3,
    },

    content:
      "Does anyone have tomorrow's Quantum Computing notes?",

    likeCount: 18,
    commentCount: 7,
    createdAt: '2m',
  },

  {
    id: '2',

    author: {
      id: 'user-2',
      name: 'Riya Sharma',
      branch: 'AIML',
      year: 2,
    },

    content:
      'Anyone interested in joining the hackathon team this weekend?',

    likeCount: 32,
    commentCount: 14,
    createdAt: '12m',
  },
];