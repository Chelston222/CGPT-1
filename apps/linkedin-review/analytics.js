'use strict';

const ANALYTICS_BRANCH = 'buffer-analytics-data';
const ANALYTICS_PATH = 'apps/linkedin-review/data/analytics-summary.json';
const ANALYTICS_ENDPOINT = `https://api.github.com/repos/${REPOSITORY}/contents/${ANALYTICS_PATH}?ref=${ANALYTICS_BRANCH}`;

const analyticsState = {
  snapshot: null,
  copiedPrompt: null,
};

const analyticsElements = {
  status: document.querySelector('#analytics-status'),
  updated: document.querySelector('#analytics-updated'),
  scheduled: document.querySelector('#analytics-scheduled'),
  sent7d: document.querySelector('#analytics-sent-7d'),
  reactions: document.querySelector('#analytics-reactions'),
  comments: document.querySelector('#analytics-comments'),
  views: document.querySelector('#analytics-views'),
  top: document.querySelector('#analytics-top-posts'),
  weak: document.querySelector('#analytics-weak-posts'),
  actions: document.querySelector('#analytics-next-actions'),
  refresh: document.querySelector('#analytics-refresh'),
  promptList: document.querySelector('#prompt-library-list'),
  promptOutput: document.querySelector('#prompt-output'),
  copyPrompt: document.querySelector('#copy-prompt'),
};

const PROMPT_LIBRARY = [
  {
    title: 'Repurpose winner',
    description: 'Turn the best performing post into more content without repeating yourself.',
    body: 'Take the strongest LinkedIn post from the analytics panel and turn it into 5 new LinkedIn posts for 222 Emails. Keep the same winning angle, but create fresh hooks, fresh examples and sharper client pain point framing. Make the outcome clear for the reader: more returning customers, more booked revenue and fewer quiet weeks.',
  },
  {
    title: 'Fix weak post',
    description: 'Rewrite low-performing content with a stronger hook and clearer offer.',
    body: 'Take the weakest LinkedIn post from the analytics panel and rewrite it into 3 stronger versions. Each version must have a specific painful problem in line one, a simple explanation, one proof or example, and a close that invites the right business owner to ask for help. UK English. No hype without substance.',
  },
  {
    title: 'Weekly decision brief',
    description: 'Convert the data into what to post, pause and double down on.',
    body: 'Using the latest Buffer analytics snapshot, give me a weekly LinkedIn decision brief for 222 Emails. Split it into: what worked, what did not, what to post more of, what to stop posting, what to repurpose today, and the next 3 posts to create. Make it founder-led, outcome-led and client pain point-led.',
  },
  {
    title: 'Hook lab',
    description: 'Create sharper hooks from the posts that already got attention.',
    body: 'Study the highest scoring posts and create 25 new LinkedIn hooks for 222 Emails. Each hook should speak to ecommerce, salons, local service businesses or small brands that are losing repeat revenue because their emails are weak, inconsistent or absent.',
  },
];

function number(value) {
  return Number(value || 0).toLocaleString('en-GB');
}

function dateLabel(value) {
  if (!value) return 'No refresh yet';
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function decodeGithubContent(payload) {
  if (!payload?.content) throw new Error('GitHub returned no analytics content.');
  const clean = String(payload.content).replace(/\s+/g, '');
  const bytes = Uint8Array.from(atob(clean), (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

async function fetchAnalyticsSnapshot() {
  const response = await fetch(ANALYTICS_ENDPOINT, { cache: 'no-store' });
  if (response.status === 404) {
    throw new Error('No analytics snapshot exists yet. Run the LinkedIn Buffer Analytics Refresh workflow once, then refresh this page.');
  }
  if (!response.ok) throw new Error(`GitHub analytics fetch returned HTTP ${response.status}.`);
  return decodeGithubContent(await response.json());
}

function renderPostList(container, posts, emptyText) {
  if (!container) return;
  container.replaceChildren();
  if (!posts?.length) {
    const item = document.createElement('li');
    item.className = 'analytics-empty';
    item.textContent = emptyText;
    container.append(item);
    return;
  }
  posts.slice(0, 5).forEach((post, index) => {
    const item = document.createElement('li');
    item.className = 'analytics-post-row';
    const rank = document.createElement('span');
    rank.className = 'analytics-rank';
    rank.textContent = String(index + 1).padStart(2, '0');
    const copy = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = post.textPreview || 'Untitled Buffer post';
    const meta = document.createElement('small');
    meta.textContent = `${post.channel || post.target || 'Unknown channel'} · score ${number(post.score)} · ${number(post.reactions)} reactions · ${number(post.comments)} comments`;
    copy.append(title, meta);
    item.append(rank, copy);
    container.append(item);
  });
}

function renderActions(actions) {
  if (!analyticsElements.actions) return;
  analyticsElements.actions.replaceChildren();
  (actions?.length ? actions : ['No analytics action yet. Keep posting until Buffer returns sent-post metrics.']).forEach((action) => {
    const item = document.createElement('li');
    item.textContent = action;
    analyticsElements.actions.append(item);
  });
}

function renderPromptLibrary(snapshot) {
  if (!analyticsElements.promptList) return;
  analyticsElements.promptList.replaceChildren();
  PROMPT_LIBRARY.forEach((prompt, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'prompt-card';
    button.innerHTML = '<strong></strong><small></small>';
    button.querySelector('strong').textContent = prompt.title;
    button.querySelector('small').textContent = prompt.description;
    button.addEventListener('click', () => selectPrompt(index, snapshot));
    analyticsElements.promptList.append(button);
  });
  if (!analyticsState.copiedPrompt) selectPrompt(0, snapshot);
}

function selectPrompt(index, snapshot = analyticsState.snapshot) {
  const prompt = PROMPT_LIBRARY[index] || PROMPT_LIBRARY[0];
  const winner = snapshot?.topPosts?.[0]?.textPreview;
  const weak = snapshot?.weakPosts?.[0]?.textPreview;
  const action = snapshot?.nextActions?.[0];
  const context = [
    winner ? `Current winning post: ${winner}` : '',
    weak ? `Current weak post: ${weak}` : '',
    action ? `Current recommended action: ${action}` : '',
  ].filter(Boolean).join('\n');
  analyticsState.copiedPrompt = `${prompt.body}${context ? `\n\nLatest analytics context:\n${context}` : ''}`;
  if (analyticsElements.promptOutput) analyticsElements.promptOutput.value = analyticsState.copiedPrompt;
}

async function copySelectedPrompt() {
  if (!analyticsState.copiedPrompt) return;
  try {
    await navigator.clipboard.writeText(analyticsState.copiedPrompt);
    analyticsElements.copyPrompt.textContent = 'Copied';
    window.setTimeout(() => { analyticsElements.copyPrompt.textContent = 'Copy prompt'; }, 1200);
  } catch {
    analyticsElements.promptOutput?.focus();
    analyticsElements.promptOutput?.select();
  }
}

function renderAnalytics(snapshot) {
  analyticsState.snapshot = snapshot;
  const totals = snapshot?.kpis?.totals30d || {};
  if (analyticsElements.status) analyticsElements.status.textContent = snapshot.warnings?.length ? 'Live with warnings' : 'Live analytics connected';
  if (analyticsElements.updated) analyticsElements.updated.textContent = dateLabel(snapshot.refreshedAt);
  if (analyticsElements.scheduled) analyticsElements.scheduled.textContent = number(snapshot?.kpis?.scheduledTotal);
  if (analyticsElements.sent7d) analyticsElements.sent7d.textContent = number(snapshot?.kpis?.sent7d);
  if (analyticsElements.reactions) analyticsElements.reactions.textContent = number(totals.reactions);
  if (analyticsElements.comments) analyticsElements.comments.textContent = number(totals.comments);
  if (analyticsElements.views) analyticsElements.views.textContent = number((totals.impressions || 0) + (totals.views || 0));
  renderPostList(analyticsElements.top, snapshot.topPosts, 'No winning posts yet.');
  renderPostList(analyticsElements.weak, snapshot.weakPosts, 'No weak posts detected yet.');
  renderActions(snapshot.nextActions);
  renderPromptLibrary(snapshot);
}

function renderAnalyticsError(error) {
  if (analyticsElements.status) analyticsElements.status.textContent = 'Analytics waiting';
  if (analyticsElements.updated) analyticsElements.updated.textContent = error.message;
  ['scheduled', 'sent7d', 'reactions', 'comments', 'views'].forEach((key) => {
    if (analyticsElements[key]) analyticsElements[key].textContent = '0';
  });
  renderPostList(analyticsElements.top, [], error.message);
  renderPostList(analyticsElements.weak, [], 'No weak posts can be scored until the first snapshot lands.');
  renderActions(['Run the analytics workflow manually once. After that, the daily refresh takes over without touching production deploys.']);
  renderPromptLibrary(null);
}

async function loadAnalytics() {
  if (!analyticsElements.status) return;
  analyticsElements.status.textContent = 'Refreshing analytics...';
  const snapshot = await fetchAnalyticsSnapshot();
  renderAnalytics(snapshot);
}

analyticsElements.refresh?.addEventListener('click', () => loadAnalytics().catch(renderAnalyticsError));
analyticsElements.copyPrompt?.addEventListener('click', copySelectedPrompt);
loadAnalytics().catch(renderAnalyticsError);
