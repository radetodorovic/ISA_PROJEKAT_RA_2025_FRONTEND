export interface Comment {
  id: number;
  text: string;
  createdAt: string;
  userId: number;
  author?: string;
  videoPostId: number;
}

export interface CommentResponse {
  id: number;
  text: string;
  createdAt: string;
  userId: number;
  videoPostId: number;
}

export interface PaginatedComments {
  content: Comment[];
  totalElements: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  hasNext: boolean;
  hasPrevious: boolean;
}
