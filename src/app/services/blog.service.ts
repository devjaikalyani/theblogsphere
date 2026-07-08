import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class BlogService {
  constructor(private http: HttpClient) {}

  getBlogs(page: number, q = '', tag = ''): Observable<any> {
    let url = `/api/blogs?page=${page}`;
    if (q) url += `&q=${encodeURIComponent(q)}`;
    if (tag) url += `&tag=${encodeURIComponent(tag)}`;
    return this.http.get(url);
  }

  getBlogById(id: number): Observable<any> {
    return this.http.get(`/api/blogs/${id}`);
  }

  /** Fetch a story by numeric id or SEO slug. */
  getBlog(idOrSlug: string | number): Observable<any> {
    return this.http.get(`/api/blogs/${idOrSlug}`);
  }

  getMyBlogs(): Observable<any[]> {
    return this.http.get<any[]>('/api/blogs/my', { withCredentials: true });
  }

  createBlog(data: { title: string; content: string; status?: string; tags?: string[]; coverImage?: string }): Observable<any> {
    return this.http.post('/api/blogs', data, { withCredentials: true });
  }

  updateBlog(id: number, data: { title?: string; content?: string; status?: string; tags?: string[]; coverImage?: string }): Observable<any> {
    return this.http.patch(`/api/blogs/${id}`, data, { withCredentials: true });
  }

  deleteBlog(id: number): Observable<void> {
    return this.http.delete<void>(`/api/blogs/${id}`, { withCredentials: true });
  }

  incrementViews(id: number): Observable<any> {
    return this.http.post(`/api/blogs/${id}/view`, {});
  }

  /** Request a human-quality neural narration. Returns the audio URL, whether
   *  it was a free cached replay, and the reader's approximate narrations left
   *  (402 when the plan's narration budget can't cover this story). */
  narrate(id: number): Observable<{ url: string; cached: boolean; pro: boolean; remaining: number | null }> {
    return this.http.post<{ url: string; cached: boolean; pro: boolean; remaining: number | null }>(
      `/api/tts/${id}`, {}, { withCredentials: true },
    );
  }

  getTags(): Observable<any[]> {
    return this.http.get<any[]>('/api/blogs/tags');
  }

  /** Top 100 stories ranked by popularity (views + engagement, recency-weighted). */
  getTrending(): Observable<any[]> {
    return this.http.get<any[]>('/api/blogs/trending');
  }

  /** Stories to read next (tag-related, topped up with recent). */
  getRelated(id: number): Observable<any[]> {
    return this.http.get<any[]>(`/api/blogs/${id}/related`);
  }

  /** AI-generated key takeaways for a story. */
  getSummary(id: number): Observable<{ summary: string[] }> {
    return this.http.get<{ summary: string[] }>(`/api/ai/summary/${id}`);
  }

  getAuthorProfile(userId: string): Observable<any> {
    return this.http.get(`/api/users/${userId}`);
  }

  // Bookmarks
  getBookmarks(): Observable<any[]> {
    return this.http.get<any[]>('/api/bookmarks', { withCredentials: true });
  }

  checkBookmark(blogId: number): Observable<{ bookmarked: boolean }> {
    return this.http.get<{ bookmarked: boolean }>(`/api/bookmarks/check/${blogId}`, { withCredentials: true });
  }

  addBookmark(blogId: number): Observable<any> {
    return this.http.post(`/api/bookmarks/${blogId}`, {}, { withCredentials: true });
  }

  removeBookmark(blogId: number): Observable<any> {
    return this.http.delete(`/api/bookmarks/${blogId}`, { withCredentials: true });
  }

  // Likes
  checkLike(blogId: number): Observable<{ liked: boolean; count: number }> {
    return this.http.get<{ liked: boolean; count: number }>(`/api/likes/check/${blogId}`, { withCredentials: true });
  }

  likePost(blogId: number): Observable<{ liked: boolean; count: number }> {
    return this.http.post<{ liked: boolean; count: number }>(`/api/likes/${blogId}`, {}, { withCredentials: true });
  }

  unlikePost(blogId: number): Observable<{ liked: boolean; count: number }> {
    return this.http.delete<{ liked: boolean; count: number }>(`/api/likes/${blogId}`, { withCredentials: true });
  }

  // Comments
  getComments(blogId: number): Observable<any[]> {
    return this.http.get<any[]>(`/api/blogs/${blogId}/comments`);
  }

  addComment(blogId: number, content: string): Observable<any> {
    return this.http.post(`/api/blogs/${blogId}/comments`, { content }, { withCredentials: true });
  }

  deleteComment(commentId: number): Observable<any> {
    return this.http.delete(`/api/comments/${commentId}`, { withCredentials: true });
  }

  // Follow
  getFollowStatus(userId: string): Observable<{ following: boolean; followers: number }> {
    return this.http.get<any>(`/api/follow/${userId}/status`, { withCredentials: true });
  }

  follow(userId: string): Observable<any> {
    return this.http.post(`/api/follow/${userId}`, {}, { withCredentials: true });
  }

  unfollow(userId: string): Observable<any> {
    return this.http.delete(`/api/follow/${userId}`, { withCredentials: true });
  }

  getFeed(): Observable<any[]> {
    return this.http.get<any[]>('/api/feed', { withCredentials: true });
  }

  // Analytics
  getMyAnalytics(): Observable<any> {
    return this.http.get('/api/analytics/my', { withCredentials: true });
  }

  // User profile
  updateProfile(data: { firstName?: string; lastName?: string; bio?: string; website?: string; writingStyle?: string; tippingEnabled?: boolean; tipUrl?: string; upiId?: string }): Observable<any> {
    return this.http.patch('/api/users/me', data, { withCredentials: true });
  }

  // Upload
  uploadCoverImage(file: File): Observable<{ url: string }> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<{ url: string }>('/api/upload/cover-image', fd, { withCredentials: true });
  }
}
