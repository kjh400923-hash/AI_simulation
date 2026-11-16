window.GameSync = (() => {
  // 서버 주소와 인증 규격이 아직 공유되지 않아 현재 프로토타입은 원격 동기화를 호출하지 않습니다.
  // 서버 API 명세가 정해지면 이 모듈만 구현해 게임 로직과 분리해 연결합니다.
  const connected = false;
  async function submitChoice() {
    throw new Error('서버 API가 연결되지 않은 1인 체험용 프로토타입입니다.');
  }
  async function loadRoom() {
    throw new Error('서버 API가 연결되지 않은 1인 체험용 프로토타입입니다.');
  }
  return {connected,submitChoice,loadRoom};
})();
