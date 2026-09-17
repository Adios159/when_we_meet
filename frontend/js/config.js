// 백엔드 주소.
// - 로컬 개발: 프론트를 연 호스트를 그대로 따라가고 포트만 8000으로 바꿔서 씀.
//   예) PC에서 http://192.168.0.5:5500 으로 열었으면 -> http://192.168.0.5:8000/api
//   이렇게 하면 같은 와이파이의 폰에서 접속해도 자동으로 같은 PC의 백엔드를 찾아감.
// - Render 배포: 프론트/백엔드가 서로 다른 도메인이라 포트 방식이 안 통해서
//   배포된 백엔드 주소를 직접 사용.
window.API_BASE =
  window.API_BASE ||
  (location.hostname.endsWith(".onrender.com")
    ? "https://when-we-meet.onrender.com/api"
    : `http://${location.hostname}:8000/api`);

// 09:00~18:00, 30분 단위 => 18칸
window.SLOT_COUNT = 18;

// 월~금 5일치 시간표를 요일별로 구분해서 저장/비교함.
window.DAY_LABELS = ["월", "화", "수", "목", "금"];
window.DAY_COUNT = window.DAY_LABELS.length;

window.slotLabel = function (i) {
  const totalMin = 9 * 60 + i * 30;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

// 전체 칸 배열에서 (요일, 시간대)에 해당하는 인덱스.
// 규칙: index = day * SLOT_COUNT + slot (요일 우선, 그 안에서 시간 순) - 백엔드와 동일해야 함.
window.cellIndex = function (day, slot) {
  return day * window.SLOT_COUNT + slot;
};
