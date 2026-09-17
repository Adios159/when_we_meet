// 백엔드 API 얇은 래퍼. fetch 실패 시 사람이 읽을 수 있는 에러를 던진다.

window.Api = (function () {
  async function request(path, options = {}) {
    let res;
    try {
      res = await fetch(`${window.API_BASE}${path}`, {
        headers: { "Content-Type": "application/json" },
        ...options,
      });
    } catch (e) {
      throw new Error(
        "백엔드 서버에 연결할 수 없어요. FastAPI 서버가 켜져 있는지 확인해주세요."
      );
    }
    if (!res.ok) {
      let detail = res.statusText;
      try {
        const body = await res.json();
        detail = body.detail || detail;
      } catch (_) {}
      throw new Error(detail);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  return {
    createRoom(name) {
      return request("/rooms", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
    },
    getRoom(roomId) {
      return request(`/rooms/${roomId}`);
    },
    submitSlots(roomId, slots, submissionId) {
      return request(`/rooms/${roomId}/submissions`, {
        method: "POST",
        body: JSON.stringify({ slots, submission_id: submissionId || null }),
      });
    },
    deleteSubmission(roomId, submissionId) {
      return request(`/rooms/${roomId}/submissions/${submissionId}`, {
        method: "DELETE",
      });
    },
    getOverlap(roomId) {
      return request(`/rooms/${roomId}/overlap`);
    },
    createPost(roomId, content) {
      return request(`/rooms/${roomId}/posts`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
    },
    getPosts(roomId) {
      return request(`/rooms/${roomId}/posts`);
    },
    createComment(roomId, postId, content) {
      return request(`/rooms/${roomId}/posts/${postId}/comments`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
    },
    getComments(roomId, postId) {
      return request(`/rooms/${roomId}/posts/${postId}/comments`);
    },
  };
})();
