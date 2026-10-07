/**
 * ==========================================================================
 * 엔화 변동 추적기 (Yen Tracker) - Frontend Application Logic
 * ==========================================================================
 */

// 애플리케이션 상태 (State)
const state = {
  currentRate: 851.32,
  fluctuation: 1.58,
  fluctuationRatio: 0.19,
  fluctuationType: 'RISING',
  cashBuyRate: 866.21,
  cashSellRate: 836.43,
  noticeRound: '211회차',
  localTradedAt: '',
  marketStatus: 'OPEN',
  history: [],
  selectedRange: '30d',
  targetRate: 845.0,
  chartInstance: null,
  naverImageCharts: {}
};

// 최근 60일 현실적인 네이버 실시간 백업 데이터 (오프라인/CORS 대비)
const FALLBACK_HISTORY = [
  { date: '2026-10-06', closePrice: 851.32, cashBuy: 866.21 },
  { date: '2026-10-05', closePrice: 849.74, cashBuy: 864.61 },
  { date: '2026-10-02', closePrice: 852.10, cashBuy: 867.01 },
  { date: '2026-10-01', closePrice: 854.85, cashBuy: 869.80 },
  { date: '2026-09-30', closePrice: 853.40, cashBuy: 868.33 },
  { date: '2026-09-29', closePrice: 855.12, cashBuy: 870.08 },
  { date: '2026-09-26', closePrice: 858.90, cashBuy: 873.93 },
  { date: '2026-09-25', closePrice: 862.15, cashBuy: 877.23 },
  { date: '2026-09-24', closePrice: 860.40, cashBuy: 875.45 },
  { date: '2026-09-23', closePrice: 858.70, cashBuy: 873.72 },
  { date: '2026-09-22', closePrice: 856.20, cashBuy: 871.18 },
  { date: '2026-09-19', closePrice: 853.80, cashBuy: 868.74 },
  { date: '2026-09-18', closePrice: 851.10, cashBuy: 865.99 },
  { date: '2026-09-17', closePrice: 848.90, cashBuy: 863.75 },
  { date: '2026-09-16', closePrice: 846.50, cashBuy: 861.31 },
  { date: '2026-09-15', closePrice: 847.20, cashBuy: 862.02 },
  { date: '2026-09-12', closePrice: 850.40, cashBuy: 865.28 },
  { date: '2026-09-11', closePrice: 853.60, cashBuy: 868.53 },
  { date: '2026-09-10', closePrice: 856.80, cashBuy: 871.79 },
  { date: '2026-09-09', closePrice: 859.30, cashBuy: 874.33 },
  { date: '2026-09-08', closePrice: 862.50, cashBuy: 877.59 },
  { date: '2026-09-05', closePrice: 865.20, cashBuy: 880.34 },
  { date: '2026-09-04', closePrice: 863.71, cashBuy: 878.82 },
  { date: '2026-09-03', closePrice: 870.23, cashBuy: 885.45 },
  { date: '2026-09-02', closePrice: 856.69, cashBuy: 871.68 },
  { date: '2026-09-01', closePrice: 858.69, cashBuy: 873.71 },
  { date: '2026-08-31', closePrice: 857.14, cashBuy: 872.13 },
  { date: '2026-08-28', closePrice: 861.84, cashBuy: 876.92 },
  { date: '2026-08-27', closePrice: 867.11, cashBuy: 882.28 },
  { date: '2026-08-26', closePrice: 869.92, cashBuy: 885.14 },
  { date: '2026-08-25', closePrice: 868.92, cashBuy: 884.12 }
];

// 초기화
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initEventListeners();
  loadAllData();
  initBudgetPlanner();
});

// 테마 초기화
function initTheme() {
  const savedTheme = localStorage.getItem('yen_theme') || 'dark';
  if (savedTheme === 'light') {
    document.body.classList.remove('dark-theme');
    document.body.classList.add('light-theme');
    document.getElementById('themeToggleBtn').innerHTML = '<span class="theme-icon">☀️</span>';
  }
}

// 이벤트 리스너 등록
function initEventListeners() {
  // 테마 토글
  const themeBtn = document.getElementById('themeToggleBtn');
  themeBtn.addEventListener('click', () => {
    const isLight = document.body.classList.toggle('light-theme');
    document.body.classList.toggle('dark-theme', !isLight);
    themeBtn.innerHTML = isLight ? '<span class="theme-icon">☀️</span>' : '<span class="theme-icon">🌙</span>';
    localStorage.setItem('yen_theme', isLight ? 'light' : 'dark');
    if (state.chartInstance) {
      updateChart(getFilteredHistory(state.selectedRange));
    }
  });

  // 새로고침 버튼
  const refreshBtn = document.getElementById('refreshBtn');
  refreshBtn.addEventListener('click', () => {
    refreshBtn.classList.add('spinning');
    loadAllData().finally(() => {
      setTimeout(() => refreshBtn.classList.remove('spinning'), 600);
    });
  });

  // 차트 범위 버튼
  document.querySelectorAll('.btn-range').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.btn-range').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      const range = e.target.dataset.range;
      state.selectedRange = range;

      const canvasWrapper = document.getElementById('canvasChartWrapper');
      const naverWrapper = document.getElementById('naverChartWrapper');

      if (range === 'naver') {
        canvasWrapper.style.display = 'none';
        naverWrapper.style.display = 'block';
        updateNaverChart('month');
      } else {
        canvasWrapper.style.display = 'block';
        naverWrapper.style.display = 'none';
        updateChart(getFilteredHistory(range));
      }
    });
  });

  // 네이버 공식 차트 기간 탭
  document.querySelectorAll('.btn-naver-period').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.btn-naver-period').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      updateNaverChart(e.target.dataset.period);
    });
  });

  // 환전 계산기 입력 바인딩
  const inputKrw = document.getElementById('inputKrw');
  const inputJpy = document.getElementById('inputJpy');

  inputKrw.addEventListener('input', () => {
    const krw = parseFloat(inputKrw.value) || 0;
    if (krw > 0 && state.currentRate > 0) {
      const jpy = Math.round((krw / (state.currentRate / 100)));
      inputJpy.value = jpy;
      updateFeeComparison(krw, jpy);
    } else {
      inputJpy.value = '';
    }
  });

  inputJpy.addEventListener('input', () => {
    const jpy = parseFloat(inputJpy.value) || 0;
    if (jpy > 0 && state.currentRate > 0) {
      const krw = Math.round(jpy * (state.currentRate / 100));
      inputKrw.value = krw;
      updateFeeComparison(krw, jpy);
    } else {
      inputKrw.value = '';
    }
  });

  // 계산기 프리셋 버튼
  document.querySelectorAll('.btn-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      inputKrw.value = btn.dataset.krw;
      inputKrw.dispatchEvent(new Event('input'));
    });
  });

  document.querySelectorAll('.btn-preset-jpy').forEach(btn => {
    btn.addEventListener('click', () => {
      inputJpy.value = btn.dataset.jpy;
      inputJpy.dispatchEvent(new Event('input'));
    });
  });

  // 계산기 단위 전환 버튼
  document.getElementById('calcSwapBtn').addEventListener('click', () => {
    const tempKrw = inputKrw.value;
    inputKrw.value = Math.round((parseFloat(inputJpy.value) || 100000) * (state.currentRate / 100));
    inputKrw.dispatchEvent(new Event('input'));
  });

  // 여행 예산 플래너 바인딩
  ['tripDays', 'budgetFood', 'budgetTransport', 'budgetShopping', 'budgetEtc'].forEach(id => {
    document.getElementById(id).addEventListener('input', recalculateTripBudget);
  });

  // 목표가 설정 버튼
  document.getElementById('setTargetBtn').addEventListener('click', () => {
    const targetVal = parseFloat(document.getElementById('targetRateInput').value);
    if (targetVal && targetVal > 0) {
      state.targetRate = targetVal;
      updateTargetAlertUI();
    }
  });
}

// 데이터 전체 로드 (실시간 + 히스토리)
async function loadAllData() {
  await Promise.all([
    fetchRealtimeDetail(),
    fetchHistoryData()
  ]);
  
  updateMainRateUI();
  runTimingAdvisor();
  updateChart(getFilteredHistory(state.selectedRange));
  recalculateTripBudget();
  updateTargetAlertUI();

  // 계산기 초기값 반영
  document.getElementById('inputKrw').dispatchEvent(new Event('input'));
}

// 실시간 환율 호출
async function fetchRealtimeDetail() {
  try {
    // 1순위: 로컬 프록시 서버 호출 (CORS 회피)
    const res = await fetch('/api/jpy/detail');
    if (res.ok) {
      const json = await res.json();
      if (json.result) {
        parseNaverDetail(json.result);
        return;
      }
    }
  } catch (e) {
    console.warn('로컬 API 실패, 백업 및 오픈 API 시도:', e);
  }

  // 2순위: 공개 무료 환율 API (open.er-api.com)
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/JPY');
    if (res.ok) {
      const data = await res.json();
      if (data.rates && data.rates.KRW) {
        const ratePer100 = (data.rates.KRW * 100);
        state.currentRate = parseFloat(ratePer100.toFixed(2));
        state.cashBuyRate = parseFloat((state.currentRate * 1.0175).toFixed(2));
        state.localTradedAt = new Date().toLocaleTimeString('ko-KR');
        state.noticeRound = '글로벌 외환 실시간';
        return;
      }
    }
  } catch (e) {
    console.error('글로벌 환율 조회 실패:', e);
  }

  // 기본 fallback 값 유지
  state.currentRate = 851.32;
  state.cashBuyRate = 866.21;
}

// 네이버 실시간 데이터 파싱
function parseNaverDetail(r) {
  state.currentRate = parseFloat(r.closePrice);
  state.fluctuation = parseFloat(r.fluctuations);
  state.fluctuationRatio = parseFloat(r.fluctuationsRatio);
  state.fluctuationType = r.fluctuationsType ? r.fluctuationsType.name : 'RISING';
  state.noticeRound = r.description || `${r.degreeCount}회차`;
  state.localTradedAt = r.localTradedAt || new Date().toISOString();
  state.marketStatus = r.marketStatus || 'OPEN';

  if (r.imageCharts) {
    state.naverImageCharts = r.imageCharts;
  }

  // 현찰 살 때 추정 (기본 스프레드 약 1.75%)
  state.cashBuyRate = parseFloat((state.currentRate * 1.0175).toFixed(2));
}

// 히스토리 데이터 호출
async function fetchHistoryData() {
  try {
    const res = await fetch('/api/jpy/history');
    if (res.ok) {
      const json = await res.json();
      if (json.result && Array.isArray(json.result)) {
        state.history = json.result.map(item => ({
          date: item.localTradedAt,
          closePrice: parseFloat(item.closePrice),
          cashBuy: parseFloat(item.cashBuyValue || (parseFloat(item.closePrice) * 1.0175).toFixed(2))
        })).reverse();
        return;
      }
    }
  } catch (e) {
    console.warn('히스토리 로드 실패, 내장 데이터 사용:', e);
  }

  // 내장 백업 데이터 사용
  state.history = [...FALLBACK_HISTORY].reverse();
}

// 메인 환율 UI 업데이트
function updateMainRateUI() {
  document.getElementById('currentRate').textContent = state.currentRate.toFixed(2);
  
  // 고시회차 및 업데이트 일시
  document.getElementById('noticeRoundBadge').textContent = state.noticeRound;
  const timeStr = state.localTradedAt ? formatDateTime(state.localTradedAt) : '방금 전';
  document.getElementById('lastUpdatedTime').textContent = `${timeStr} 기준`;

  // 등락폭 표시
  const flucContainer = document.getElementById('fluctuationContainer');
  const flucIcon = document.getElementById('flucIcon');
  const flucDiff = document.getElementById('flucDiff');
  const flucRatio = document.getElementById('flucRatio');

  const isUp = state.fluctuationType === 'RISING' || state.fluctuation > 0;
  const isDown = state.fluctuationType === 'FALLING' || state.fluctuation < 0;

  flucContainer.classList.remove('up', 'down');
  if (isUp) {
    flucContainer.classList.add('up');
    flucIcon.textContent = '▲';
    flucDiff.textContent = `+${Math.abs(state.fluctuation).toFixed(2)}`;
    flucRatio.textContent = `(+${Math.abs(state.fluctuationRatio).toFixed(2)}%)`;
  } else if (isDown) {
    flucContainer.classList.add('down');
    flucIcon.textContent = '▼';
    flucDiff.textContent = `-${Math.abs(state.fluctuation).toFixed(2)}`;
    flucRatio.textContent = `(-${Math.abs(state.fluctuationRatio).toFixed(2)}%)`;
  } else {
    flucIcon.textContent = '-';
    flucDiff.textContent = '0.00';
    flucRatio.textContent = '(0.00%)';
  }

  // 세부 가격표
  const base = state.currentRate;
  const cashBuy = state.cashBuyRate;
  const spread = cashBuy - base;
  const bank90 = base + (spread * 0.1); // 90% 우대 시 스프레드의 10%만 가산

  document.getElementById('rateBase').textContent = `${base.toFixed(2)}원`;
  document.getElementById('rateTravelCard').textContent = `${base.toFixed(2)}원`;
  document.getElementById('rateBank90').textContent = `${bank90.toFixed(2)}원`;
  document.getElementById('rateCashBuy').textContent = `${cashBuy.toFixed(2)}원`;

  // 시장 상태
  const marketBadge = document.getElementById('marketStatusBadge');
  const marketText = document.getElementById('marketStatusText');
  if (state.marketStatus === 'OPEN') {
    marketText.textContent = '외환시장 개장 중';
    marketBadge.style.color = '#10b981';
    marketBadge.style.background = 'rgba(16, 185, 129, 0.12)';
  } else {
    marketText.textContent = '장마감 (최종고시)';
    marketBadge.style.color = '#8e9bb5';
    marketBadge.style.background = 'rgba(255, 255, 255, 0.08)';
  }
}

/**
 * ==========================================================================
 * 다각도 매수 타이밍 분석 알고리즘 (Multi-Aspect Timing Advisor)
 * ==========================================================================
 */
function runTimingAdvisor() {
  const current = state.currentRate;
  const history = state.history;
  
  // 1. 가격 밴드 분석 (40% 가중치)
  // 역대/최근 60일 밴드 기준
  let priceBandScore = 50;
  let priceBandStatus = '보통';
  let priceBandDesc = '';

  if (current < 850) {
    priceBandScore = 95;
    priceBandStatus = '역대급 저점 (강력 추천)';
    priceBandDesc = `현재 100엔당 ${current.toFixed(2)}원으로, 850원 미만의 역사적 엔저 바닥권입니다. 적극적인 매수를 추천합니다.`;
  } else if (current < 870) {
    priceBandScore = 85;
    priceBandStatus = '매우 매력적 (분할 매수)';
    priceBandDesc = `850~870원 박스권 하단에 위치해 있어, 여행 경비의 50% 이상을 선제 환전하기에 훌륭한 타이밍입니다.`;
  } else if (current < 890) {
    priceBandScore = 65;
    priceBandStatus = '적정 관망 (소액 분할)';
    priceBandDesc = `870~890원 사이의 중간 밴드입니다. 급하지 않다면 850원대 조정을 기다리거나 20%만 소액 환전하세요.`;
  } else {
    priceBandScore = 35;
    priceBandStatus = '단기 고점 (매수 보류)';
    priceBandDesc = `900원 근방 고점에 도달했습니다. 단기 차익 실현 및 반락 가능성이 있으므로 환전을 대기하세요.`;
  }

  // 2. 기술적 지표 (RSI & 20일 이동평균선) (30% 가중치)
  const rsi = calculateRSI(history, 14);
  const ma20 = calculateMA(history, 20);
  const disparity = ma20 ? ((current / ma20) * 100) : 100; // 이격도

  let techScore = 60;
  let techStatus = '중립 모멘텀';
  let techDesc = '';

  if (rsi <= 35) {
    techScore = 90;
    techStatus = '과매도 (반등 직전 저점)';
    techDesc = `14일 RSI 지표가 ${rsi.toFixed(1)}로 침체(과매도) 상태입니다. 기술적으로 최저점 매수 신호가 발생했습니다.`;
  } else if (rsi >= 65) {
    techScore = 35;
    techStatus = '과매수 (조정 주의)';
    techDesc = `14일 RSI가 ${rsi.toFixed(1)}로 단기 과열권입니다. 추가 하락 조정 후 매수를 권장합니다.`;
  } else {
    techScore = 75;
    techStatus = '안정적 횡보';
    techDesc = `RSI ${rsi.toFixed(1)}, 20일선 대비 이격도 ${disparity.toFixed(1)}%로 급격한 변동 없이 안정적인 흐름입니다.`;
  }

  // 3. 거시 경제 및 금리 정책 (15% 가중치)
  const macroScore = 80; // 일본은행(BOJ) 금리 인상 기조 감안 시 엔화는 장기적으로 상승 압력이 높음
  const macroStatus = '엔저 기회';
  const macroDesc = '일본은행(BOJ)의 점진적 금리 인상 정책으로 인해 중장기적으로 엔화가 다시 900원대로 올라갈 압력이 있습니다. 현재의 엔저는 여행자에게 기회입니다.';

  // 4. 여행자 맞춤형 분할 환전 (DCA) 가이드 (15% 가중치)
  let dcaPill1 = '40%';
  let dcaPill2 = '40%';
  let dcaPill3 = '20%';
  let dcaDesc = '';

  if (priceBandScore >= 85) {
    dcaPill1 = '50%';
    dcaPill2 = '30%';
    dcaPill3 = '20%';
    dcaDesc = '지금 가격이 매우 유리하므로 전체 예산의 50%를 1차로 즉시 환전하고, 출발 전 추가 분할을 추천합니다.';
  } else {
    dcaPill1 = '30%';
    dcaPill2 = '40%';
    dcaPill3 = '30%';
    dcaDesc = '단기 등락 위험을 줄이기 위해 지금 30%만 소액 환전하고, 850원 초반 터치 시 2차로 40%를 채우세요.';
  }

  // 종합 점수 산출 (가중 평균)
  const totalScore = Math.round(
    (priceBandScore * 0.40) +
    (techScore * 0.30) +
    (macroScore * 0.15) +
    (75 * 0.15)
  );

  // UI 반영: 팩터별 게이지 & 설명
  document.getElementById('badgePriceBand').textContent = priceBandStatus;
  document.getElementById('barFillPriceBand').style.width = `${priceBandScore}%`;
  document.getElementById('descPriceBand').textContent = priceBandDesc;

  document.getElementById('badgeTechnical').textContent = techStatus;
  document.getElementById('barFillTechnical').style.width = `${techScore}%`;
  document.getElementById('descTechnical').textContent = techDesc;

  document.getElementById('badgeMacro').textContent = macroStatus;
  document.getElementById('barFillMacro').style.width = `${macroScore}%`;
  document.getElementById('descMacro').textContent = macroDesc;

  document.getElementById('dcaPill1').textContent = dcaPill1;
  document.getElementById('dcaPill2').textContent = dcaPill2;
  document.getElementById('dcaPill3').textContent = dcaPill3;
  document.getElementById('descDCA').textContent = dcaDesc;

  // 종합 타이밍 신호등 배너 업데이트
  updateTimingVerdictBanner(totalScore, current);
}

// 종합 판정 배너 업데이트
function updateTimingVerdictBanner(score, rate) {
  const scoreText = document.getElementById('scoreText');
  const scoreCircle = document.getElementById('scoreCircle');
  const verdictTag = document.getElementById('verdictTag');
  const verdictTitle = document.getElementById('verdictTitle');
  const verdictDesc = document.getElementById('verdictDesc');
  const timingBox = document.getElementById('timingVerdictBox');
  const actionText = document.getElementById('advisorActionText');

  scoreText.textContent = `${score}`;
  scoreCircle.setAttribute('stroke-dasharray', `${score}, 100`);

  if (score >= 80) {
    scoreCircle.style.stroke = '#10b981';
    verdictTag.style.background = '#10b981';
    verdictTag.textContent = '적극 분할 매수 적기 (BUY NOW)';
    verdictTitle.textContent = `현재 ${rate.toFixed(2)}원은 엔화 매수 최적의 구간입니다!`;
    verdictDesc.textContent = '역사적 저점 밴드와 기술적 지표가 모두 매수를 지지합니다. 여행 예산의 50% 이상을 트래블카드로 환전해 두세요.';
    timingBox.style.borderColor = 'rgba(16, 185, 129, 0.4)';
    timingBox.style.background = 'rgba(16, 185, 129, 0.1)';
    actionText.textContent = `현재 850원대 초반은 놓치기 아까운 매수 찬스입니다. 토스뱅크 외화통장이나 트래블로그/월렛에 여행 경비의 50%를 오늘 즉시 환전해 두세요!`;
  } else if (score >= 65) {
    scoreCircle.style.stroke = '#00d2ff';
    verdictTag.style.background = '#00d2ff';
    verdictTag.style.color = '#0a0e17';
    verdictTag.textContent = '안정적 분할 매수 (ACCUMULATE)';
    verdictTitle.textContent = `환율이 안정권에 진입했습니다. 소액 분할을 시작하세요.`;
    verdictDesc.textContent = '무리하게 전액 환전하기보다는 30%씩 나누어 매수하여 추가 하락 시 평단가를 낮추는 전략이 유리합니다.';
    timingBox.style.borderColor = 'rgba(0, 210, 255, 0.4)';
    timingBox.style.background = 'rgba(0, 210, 255, 0.08)';
    actionText.textContent = `현재 환율도 충분히 좋습니다. 토스나 트래블카드로 전체 경비의 30%를 먼저 환전하고, 여행 1주일 전까지 추가 하락을 지켜보세요.`;
  } else if (score >= 50) {
    scoreCircle.style.stroke = '#f59e0b';
    verdictTag.style.background = '#f59e0b';
    verdictTag.textContent = '관망 및 모니터링 (HOLD)';
    verdictTitle.textContent = `단기 변동성이 있습니다. 850원 초반 조정을 기다리세요.`;
    verdictDesc.textContent = '조금 더 저렴하게 살 수 있는 기회가 올 수 있습니다. 여행 일정이 여유롭다면 850원 초반대 알림을 켜두고 관망하세요.';
    timingBox.style.borderColor = 'rgba(245, 158, 11, 0.4)';
    timingBox.style.background = 'rgba(245, 158, 11, 0.08)';
    actionText.textContent = `당장 환전하지 마시고 목표가(850원) 알림을 설정해 두신 후, 1~2일 내 눌림목을 노려보세요.`;
  } else {
    scoreCircle.style.stroke = '#ef4444';
    verdictTag.style.background = '#ef4444';
    verdictTag.textContent = '매수 보류 (WAIT)';
    verdictTitle.textContent = `단기 고점 구간입니다. 지금 환전은 손해일 수 있습니다.`;
    verdictDesc.textContent = '단기 과열로 인해 환율이 높게 형성되어 있습니다. 며칠간의 가격 조정을 기다려 매수 타이밍을 잡으세요.';
    timingBox.style.borderColor = 'rgba(239, 68, 68, 0.4)';
    timingBox.style.background = 'rgba(239, 68, 68, 0.08)';
    actionText.textContent = `현재는 고점 구간입니다. 급한 경우가 아니라면 환전을 미루고 반락을 기다리시는 것이 좋습니다.`;
  }
}

/**
 * ==========================================================================
 * 기술적 분석 헬퍼 (RSI, MA 계산)
 * ==========================================================================
 */
function calculateRSI(history, period = 14) {
  if (!history || history.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = history.length - period; i < history.length; i++) {
    const diff = history[i].closePrice - history[i - 1].closePrice;
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateMA(history, period = 20) {
  if (!history || history.length < period) return null;
  const slice = history.slice(history.length - period);
  const sum = slice.reduce((acc, cur) => acc + cur.closePrice, 0);
  return sum / period;
}

/**
 * ==========================================================================
 * 인터랙티브 차트 렌더링 (Chart.js)
 * ==========================================================================
 */
function getFilteredHistory(range) {
  const all = state.history;
  if (!all || all.length === 0) return [];

  let count = 30;
  if (range === '7d') count = 7;
  else if (range === '30d') count = 30;
  else if (range === '60d') count = 60;

  return all.slice(Math.max(all.length - count, 0));
}

function updateChart(dataSlice) {
  if (!dataSlice || dataSlice.length === 0) return;

  const ctx = document.getElementById('rateHistoryChart');
  if (!ctx) return;

  const isLight = document.body.classList.contains('light-theme');
  const labels = dataSlice.map(d => d.date.substring(5)); // MM-DD
  const prices = dataSlice.map(d => d.closePrice);

  // 통계 계산
  const minVal = Math.min(...prices);
  const maxVal = Math.max(...prices);
  const avgVal = (prices.reduce((a, b) => a + b, 0) / prices.length);
  const current = state.currentRate;

  document.getElementById('statMinRate').textContent = `${minVal.toFixed(2)}원`;
  document.getElementById('statAvgRate').textContent = `${avgVal.toFixed(2)}원`;
  document.getElementById('statMaxRate').textContent = `${maxVal.toFixed(2)}원`;

  // 백분위 위치
  const rangeDiff = maxVal - minVal;
  const percentile = rangeDiff > 0 ? Math.round(((current - minVal) / rangeDiff) * 100) : 50;
  document.getElementById('statPercentile').textContent = `${percentile}% (밴드 내 위치)`;

  // 차트 생성 또는 업데이트
  if (state.chartInstance) {
    state.chartInstance.destroy();
  }

  const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 260);
  gradient.addColorStop(0, 'rgba(0, 210, 255, 0.35)');
  gradient.addColorStop(1, 'rgba(0, 210, 255, 0.00)');

  // eslint-disable-next-line no-undef
  state.chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: '매매기준율 (100엔당)',
        data: prices,
        borderColor: '#00d2ff',
        borderWidth: 2.5,
        backgroundColor: gradient,
        fill: true,
        tension: 0.35,
        pointRadius: dataSlice.length <= 10 ? 4 : 2,
        pointHoverRadius: 6,
        pointBackgroundColor: '#00d2ff',
        pointBorderColor: isLight ? '#ffffff' : '#0a0e17',
        pointBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(18, 24, 40, 0.95)',
          titleColor: isLight ? '#182033' : '#f0f4fc',
          bodyColor: isLight ? '#182033' : '#00d2ff',
          borderColor: 'rgba(0, 210, 255, 0.3)',
          borderWidth: 1,
          padding: 10,
          displayColors: false,
          callbacks: {
            label: (ctx) => `환율: ${ctx.parsed.y.toFixed(2)}원 / 100엔`
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)'
          },
          ticks: {
            color: isLight ? '#8e9bb5' : '#5c6882',
            font: { size: 11 }
          }
        },
        y: {
          grid: {
            color: isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)'
          },
          ticks: {
            color: isLight ? '#8e9bb5' : '#5c6882',
            font: { size: 11 },
            callback: (val) => `${val.toFixed(0)}원`
          },
          suggestedMin: minVal - 3,
          suggestedMax: maxVal + 3
        }
      }
    }
  });
}

// 네이버 공식 차트 이미지 업데이트
function updateNaverChart(period) {
  const img = document.getElementById('naverChartImg');
  const urls = state.naverImageCharts;
  let targetUrl = '';

  if (period === 'month') targetUrl = urls.areaMonth || 'https://financial-vn.pstatic.net/chart/mobile/marketindex/month/FX_JPYKRW_end.png';
  else if (period === 'month3') targetUrl = urls.areaMonthThree || 'https://financial-vn.pstatic.net/chart/mobile/marketindex/month3/FX_JPYKRW_end.png';
  else if (period === 'year') targetUrl = urls.areaYear || 'https://financial-vn.pstatic.net/chart/mobile/marketindex/year/FX_JPYKRW_end.png';
  else if (period === 'year3') targetUrl = urls.areaYearThree || 'https://financial-vn.pstatic.net/chart/mobile/marketindex/year3/FX_JPYKRW_end.png';
  else if (period === 'year10') targetUrl = urls.areaYearTen || 'https://financial-vn.pstatic.net/chart/mobile/marketindex/year10/FX_JPYKRW_end.png';

  img.src = `${targetUrl}?t=${Date.now()}`;
}

/**
 * ==========================================================================
 * 환전 계산기 & 수수료 비교
 * ==========================================================================
 */
function updateFeeComparison(krw, jpy) {
  if (!jpy || jpy <= 0 || !state.currentRate) return;

  const baseRate = state.currentRate / 100;
  const cashBuyRate = state.cashBuyRate / 100;
  const spread = cashBuyRate - baseRate;
  const bank90Rate = baseRate + (spread * 0.1);

  // 1. 트래블로그 (100% 우대, 기준가 환전)
  const travelKrw = Math.round(jpy * baseRate);
  // 2. 모바일 은행 (90% 우대)
  const bank90Krw = Math.round(jpy * bank90Rate);
  // 3. 은행 창구 / 공항 (0% 우대, 현찰 살 때)
  const cashBuyKrw = Math.round(jpy * cashBuyRate);

  document.getElementById('compTravelAmount').textContent = `${travelKrw.toLocaleString('ko-KR')}원`;
  document.getElementById('compBank90Amount').textContent = `${bank90Krw.toLocaleString('ko-KR')}원`;
  document.getElementById('compCashBuyAmount').textContent = `${cashBuyKrw.toLocaleString('ko-KR')}원`;

  const bank90Diff = bank90Krw - travelKrw;
  const cashBuyDiff = cashBuyKrw - travelKrw;

  document.getElementById('compBank90Diff').textContent = `+${bank90Diff.toLocaleString('ko-KR')}원 차이`;
  document.getElementById('compCashBuyDiff').textContent = `+${cashBuyDiff.toLocaleString('ko-KR')}원 낭비`;
}

/**
 * ==========================================================================
 * 일본 여행 예산 플래너 (Budget Planner)
 * ==========================================================================
 */
function initBudgetPlanner() {
  recalculateTripBudget();
}

function recalculateTripBudget() {
  const days = parseInt(document.getElementById('tripDays').value) || 4;
  const foodPerDay = parseFloat(document.getElementById('budgetFood').value) || 5000;
  const transportPerDay = parseFloat(document.getElementById('budgetTransport').value) || 1200;
  const shoppingTotal = parseFloat(document.getElementById('budgetShopping').value) || 25000;
  const etcTotal = parseFloat(document.getElementById('budgetEtc').value) || 15000;

  const totalFood = foodPerDay * days;
  const totalTransport = transportPerDay * days;
  const totalJpy = totalFood + totalTransport + shoppingTotal + etcTotal;

  document.getElementById('tripTotalJpy').textContent = totalJpy.toLocaleString('ko-KR');

  const baseRate = state.currentRate / 100;
  const totalKrw = Math.round(totalJpy * baseRate);
  document.getElementById('tripTotalKrw').textContent = totalKrw.toLocaleString('ko-KR');

  // 분할 환전 일정표 수치
  const stage1Jpy = Math.round(totalJpy * 0.40);
  const stage2Jpy = Math.round(totalJpy * 0.40);
  const stage3Jpy = totalJpy - stage1Jpy - stage2Jpy;

  document.getElementById('planStage1').textContent = `${stage1Jpy.toLocaleString('ko-KR')}엔 (약 ${Math.round(stage1Jpy * baseRate).toLocaleString()}원)`;
  document.getElementById('planStage2').textContent = `${stage2Jpy.toLocaleString('ko-KR')}엔 (약 ${Math.round(stage2Jpy * baseRate).toLocaleString()}원)`;
  document.getElementById('planStage3').textContent = `${stage3Jpy.toLocaleString('ko-KR')}엔 (약 ${Math.round(stage3Jpy * baseRate).toLocaleString()}원)`;
}

/**
 * ==========================================================================
 * 목표 환율 알림 시뮬레이터 (Target Rate Watcher)
 * ==========================================================================
 */
function updateTargetAlertUI() {
  const target = state.targetRate;
  const current = state.currentRate;
  const diffPercent = (((current - target) / target) * 100);

  const headline = document.getElementById('alertHeadline');
  const sub = document.getElementById('alertSub');
  const pill = document.getElementById('alertDiffPill');
  const icon = document.getElementById('alertStatusIcon');

  if (current <= target) {
    icon.textContent = '🎉';
    headline.textContent = `목표 환율 달성! (${target.toFixed(2)}원 이하)`;
    sub.textContent = `현재 ${current.toFixed(2)}원으로 설정하신 목표가에 이미 도달했습니다. 지금 즉시 환전하세요!`;
    pill.textContent = '목표가 도달!';
    pill.style.background = 'rgba(16, 185, 129, 0.2)';
    pill.style.color = '#10b981';
  } else {
    icon.textContent = '🎯';
    headline.textContent = `목표가 ${target.toFixed(2)}원 추적 중`;
    sub.textContent = `현재가(${current.toFixed(2)}원)보다 약 ${Math.abs(current - target).toFixed(2)}원(${diffPercent.toFixed(1)}%) 더 하락하면 도달합니다.`;
    pill.textContent = `+${diffPercent.toFixed(1)}% 이격`;
    pill.style.background = 'rgba(0, 210, 255, 0.12)';
    pill.style.color = '#00d2ff';
  }
}

// 일시 포맷 헬퍼
function formatDateTime(isoString) {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${d.getMonth() + 1}월 ${d.getDate()}일 ${hours}:${mins}`;
  } catch (e) {
    return isoString;
  }
}
