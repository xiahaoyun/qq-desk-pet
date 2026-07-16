import './styles.css';

const actions = [
  { id: 'idle', label: '待机', icon: '•' },
  { id: 'walk', label: '走动', icon: '↔' },
  { id: 'sit', label: '坐下', icon: '▾' },
  { id: 'jump', label: '跳跃', icon: '↟' },
  { id: 'wave', label: '打招呼', icon: '✦' },
  { id: 'sleep', label: '睡觉', icon: 'z' }
];

const app = document.querySelector('#app');
document.documentElement.dataset.runtime = window.deskPet ? 'electron' : 'preview';
app.innerHTML = `
  <main class="stage" data-action="idle">
    <section class="pet-shell" aria-label="QQ desktop pet">
      ${actions.map(action => `
        <img
          class="pet-asset"
          data-asset-action="${action.id}"
          src="assets/qq-${action.id}.webp"
          alt=""
          draggable="false"
        >
      `).join('')}
    </section>
    <nav class="controls" aria-label="pet actions">
      ${actions.map(action => `
        <button class="control" type="button" data-pet-action="${action.id}" title="${action.label}" aria-label="${action.label}">
          <span>${action.icon}</span>
        </button>
      `).join('')}
      <button class="control close" type="button" data-close title="退出" aria-label="退出"><span>×</span></button>
    </nav>
  </main>
`;

const stage = document.querySelector('.stage');
const controls = document.querySelectorAll('[data-pet-action]');
const closeButton = document.querySelector('[data-close]');
const assets = document.querySelectorAll('[data-asset-action]');
const previewDirection = new URLSearchParams(window.location.search).get('direction');
const shortActionDuration = 3600;
const sleepActionDuration = 15 * 60 * 1000;
let actionTimer;
let idleCycle = 0;

if (!window.deskPet && ['left', 'right'].includes(previewDirection)) {
  stage.dataset.direction = previewDirection;
}

function setAction(action, options = {}) {
  const { autoIdle = false, direction } = options;
  stage.dataset.action = action;
  if (direction) stage.dataset.direction = direction;
  controls.forEach(button => {
    button.toggleAttribute('aria-current', button.dataset.petAction === action);
  });
  assets.forEach(asset => {
    asset.classList.toggle('is-active', asset.dataset.assetAction === action);
  });
  window.deskPet?.reportAction(action);

  window.clearTimeout(actionTimer);
  const duration = action === 'sleep' ? sleepActionDuration : shortActionDuration;
  if (autoIdle || action === 'sleep') {
    actionTimer = window.setTimeout(() => setAction('idle'), duration);
  }
}

controls.forEach(button => {
  button.addEventListener('click', event => {
    event.stopPropagation();
    setAction(button.dataset.petAction);
  });
});

closeButton.addEventListener('click', event => {
  event.stopPropagation();
  window.deskPet?.close();
});

stage.addEventListener('click', () => setAction('wave', { autoIdle: true }));
stage.addEventListener('dblclick', () => setAction('jump', { autoIdle: true }));

window.setInterval(() => {
  if (stage.dataset.action !== 'idle') return;
  idleCycle += 1;
  if (idleCycle % 5 === 0) setAction('sit', { autoIdle: true });
  if (idleCycle % 9 === 0) setAction('sleep');
}, 5000);

window.deskPet?.onAction((action, options = {}) => {
  setAction(action, { ...options, autoIdle: ['jump', 'wave'].includes(action) });
});

setAction('idle');
