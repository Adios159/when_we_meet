// 월~금 x 09:00~18:00(30분 단위 18칸) 클릭형 시간표 그리드.
// slots[day*SLOT_COUNT+slot] === true  -> 바쁨(busy)
// slots[day*SLOT_COUNT+slot] === false -> 비어있음(free)

window.TimeGrid = function (containerEl, initial) {
  const nSlots = window.SLOT_COUNT;
  const nDays = window.DAY_COUNT;
  const total = nSlots * nDays;
  let slots = initial ? initial.slice(0, total) : new Array(total).fill(false);
  while (slots.length < total) slots.push(false);

  const cellEls = [];

  function render() {
    containerEl.innerHTML = "";
    const table = document.createElement("div");
    table.className = "grid-table";
    table.style.setProperty("--day-count", nDays);

    // 헤더 행: 왼쪽 위 빈 칸 + 요일 라벨
    table.appendChild(document.createElement("div"));
    for (let d = 0; d < nDays; d++) {
      const dayHead = document.createElement("div");
      dayHead.className = "grid-day-head";
      dayHead.textContent = window.DAY_LABELS[d];
      table.appendChild(dayHead);
    }

    for (let s = 0; s < nSlots; s++) {
      const timeLabel = document.createElement("div");
      timeLabel.className = "grid-cell-time";
      // 매 시 정각에만 라벨 표시 (30분 칸은 비워서 촘촘함 방지)
      timeLabel.textContent = s % 2 === 0 ? window.slotLabel(s) : "";
      table.appendChild(timeLabel);

      for (let d = 0; d < nDays; d++) {
        const i = window.cellIndex(d, s);
        const cell = document.createElement("div");
        cell.className = "grid-cell" + (slots[i] ? " busy" : "");
        cell.dataset.index = String(i);
        cell.title = `${window.DAY_LABELS[d]} ${window.slotLabel(s)}`;
        cell.addEventListener("click", () => toggle(i));
        table.appendChild(cell);
        cellEls[i] = cell;
      }
    }
    containerEl.appendChild(table);
  }

  function toggle(i) {
    slots[i] = !slots[i];
    cellEls[i].classList.toggle("busy", slots[i]);
  }

  function setAll(newSlots) {
    slots = newSlots.slice(0, total);
    while (slots.length < total) slots.push(false);
    for (let i = 0; i < total; i++) {
      cellEls[i].classList.toggle("busy", slots[i]);
    }
  }

  function clear() {
    setAll(new Array(total).fill(false));
  }

  render();

  return {
    getSlots: () => slots.slice(),
    setAll,
    clear,
  };
};
