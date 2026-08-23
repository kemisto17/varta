import type { FeedPost } from '../types/post';

export const mockPosts: FeedPost[] = [
  {
    id: '1',

    author: {
      avatarPath: null,
      fullName: 'Aarav Mehta',
      id: 'user-1',
      branch: 'CSE',
      institute: {
        id: 'institute-1',
        name: 'Sample Institute of Technology',
        shortName: 'SIT',
      },
      username: 'aarav',
      year: 3,
    },
    authorId: 'user-1',
    content:
      "Does anyone have tomorrow's Quantum Computing notes?",
    imagePath: null,
    imageUrl: null,
    likeCount: 18,
    commentCount: 7,
    createdAt: '2026-08-23T17:28:00.000Z',
  },

  {
    id: '2',

    author: {
      avatarPath: null,
      fullName: 'Riya Sharma',
      id: 'user-2',
      branch: 'AIML',
      institute: {
        id: 'institute-1',
        name: 'Sample Institute of Technology',
        shortName: 'SIT',
      },
      username: 'riya',
      year: 2,
    },
    authorId: 'user-2',
    content:
      'Anyone interested in joining the hackathon team this weekend?',
    imagePath: null,
    imageUrl: null,
    likeCount: 32,
    commentCount: 14,
    createdAt: '2026-08-23T17:18:00.000Z',
  },
];
