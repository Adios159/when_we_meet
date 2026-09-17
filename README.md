# FreeTime Finder — 조별과제 시간표 맞추기

여러 명이 각자 시간표(09:00~18:00, 30분 단위)를 익명으로 제출하면,
**전원이 비어있는 시간대만** 계산해서 보여주는 웹 서비스입니다.

## 구조

```
freetime-finder/
├── backend/           FastAPI + SQLite (공유 데이터 저장/계산)
│   ├── main.py
│   └── requirements.txt
└── frontend/          바닐라 JS (그리드, 스크린샷 정렬, 결과 화면)
    ├── index.html     방 만들기 / 참여하기
    ├── room.html       내 시간표 입력 + 겹치는 시간 보기
    ├── style.css
    └── js/
        ├── config.js
        ├── api.js
        ├── grid.js
        ├── screenshot.js
        └── main.js
```

## 프라이버시 설계

- 과목명, 작성자 이름은 애초에 서버로 전송하지 않습니다.
- 서버에는 사람별로 "18칸 busy/free 배열"만 저장됩니다.
- `/overlap` API는 원본 제출 데이터를 절대 돌려주지 않고,
  "칸별로 몇 명이 비어있는지"와 "전원이 비어있는 칸"만 계산해서 응답합니다.
  즉, 프론트엔드 쪽에서는 누가 언제 바쁜지 재구성할 방법이 없습니다.
- 브라우저에는 "내가 어떤 submission_id로 제출했는지"만 localStorage에
  저장되어, 나중에 내 시간표를 수정할 때 새로 만들지 않고 덮어씁니다.

## 실행 방법

### 1. 백엔드 실행

```bash
cd backend
pip install -r requirements.txt --break-system-packages   # 필요 시
uvicorn main:app --reload --port 8000
```

정상적으로 뜨면 `http://localhost:8000/api/health` 에서 `{"status":"ok"}` 확인 가능.

### 2. 프론트엔드 실행

정적 파일이라 아무 방법으로나 서빙하면 됩니다. 예:

```bash
cd frontend
python3 -m http.server 5500
```

브라우저에서 `http://localhost:5500` 접속.

> 다른 컴퓨터(조원)에게 공유하려면, 백엔드를 배포(Render, Railway 등)하고
> `frontend/js/config.js`의 `API_BASE`를 배포된 주소로 바꾼 뒤,
> 프론트엔드도 GitHub Pages / Vercel / Netlify 같은 곳에 올리면 됩니다.
> (둘 다 로컬에서만 켜두면 본인 컴퓨터 밖에서는 접속할 수 없어요.)

## 사용 흐름

1. `index.html`에서 방을 만들면 공유 링크가 생성됨 (`room.html?room=xxxxx`)
2. 조원들에게 링크 공유
3. 각자 "내 시간표 입력" 탭에서:
   - 그리드를 직접 클릭해서 바쁜 시간을 표시하거나,
   - 스크린샷을 올리고 파란 점 두 개로 "09:00~18:00 한 요일 칸" 영역을 맞춘 뒤
     빈 칸 배경색을 지정하고 "자동 감지" (색상 분석 + 선택적 OCR)
   - "제출하기" 클릭
4. "우리 모두 비는 시간" 탭에서 전원이 비는 시간대를 확인

## 스크린샷 자동 인식에 대한 주의사항

- 이 기능은 완벽하지 않습니다. 학교 시간표 앱마다 디자인이 달라서,
  색상 기반 감지 정확도가 다를 수 있습니다. 자동 감지 후 항상 그리드에서
  눈으로 확인하고 틀린 칸은 직접 클릭해서 고치는 걸 권장합니다.
- OCR(글자 인식)은 tesseract.js를 CDN에서 불러와 사용하며, 인터넷 연결이
  필요하고 처리 시간이 걸립니다. 색상 분석만으로 충분히 정확하다면 굳이
  켤 필요는 없습니다.
- 현재 그리드는 "하루 09:00~18:00"만 다룹니다. 요일별로 다른 일정이라면
  요일마다 새 방을 만들거나, 스크린샷에서 해당 요일 칸만 영역으로
  잡아 제출해주세요.

## 배포 시 체크리스트

- [ ] `backend`를 Render/Railway 등에 배포 (SQLite 파일은 인스턴스 재시작 시
      초기화될 수 있으니, 오래 쓰려면 PostgreSQL 등으로 교체 권장)
- [ ] `frontend/js/config.js`의 `API_BASE`를 배포 주소로 변경
- [ ] `backend/main.py`의 CORS `allow_origins`를 실제 프론트 도메인으로 좁히기
- [ ] `frontend`를 정적 호스팅(GitHub Pages, Vercel, Netlify)에 배포
