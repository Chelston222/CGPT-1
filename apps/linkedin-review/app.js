'use strict';

const REPOSITORY = 'Chelston222/CGPT-1';
const CHANNEL_LABELS = {
  personal: 'Chelston · Personal',
  main: '222 Emails · Main',
  secondary: 'TTE · Secondary',
};
const STATUS_ORDER = ['draft', 'review', 'approved', 'rejected', 'scheduled', 'published', 'failed'];

const state = {
  posts: [],
  filtered: [],
  issues: [],
  index: 0,
  filter: 'review',
  category: 'all',
  decision: null,
};

const elements = {
  card: document.querySelector('#review-card'),
  template: document.querySelector('#post-template'),
  controls: document.querySelector('#decision-controls'),
  swipeHint: document.querySelector('#swipe-hint'),
  approve: document.querySelector('#approve-button'),
  reject: document.querySelector('#reject-button'),
  refresh: document.querySelector('#refresh-button'),
  position: document.querySelector('#position'),
  progress: document.querySelector('#progress'),
  sync: document.querySelector('#sync-state'),
  list: document.querySelector('#queue-list'),
  category: document.querySelector('#category-filter'),
  sheet: document.querySelector('#decision-sheet'),
  sheetEyebrow: document.querySelector('#sheet-eyebrow'),
  sheetTitle: document.querySelector('#sheet-title'),
  sheetCopy: document.querySelector('#sheet-copy'),
  sheetAction: document.querySelector('#sheet-action'),
  feedbackField: document.querySelector('#feedback-field'),
  rejectionNote: document.querySelector('#rejection-note'),
  safetyNote: document.querySelector('#safety-note'),
};

function escapeForIssue(value) {
  return String(value || '').trim();
}

function displayCategory(category) {
  return String(category).split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function formatDate(value) {
  const date = new Date(value);
  return {
    primary: new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(date),
    secondary: new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(date),
  };
}

function titleHasPostId(issue, postId) {
  return issue.title.includes(postId) || String(issue.body || '').includes(`POST_ID: ${postId}`);
}

function statusFromIssues(post) {
  const matching = state.issues
    .filter((issue) => titleHasPostId(issue, post.id))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  if (!matching.length) return post.status || 'review';

  const published = matching.find((issue) => issue.title.startsWith('[PUBLISHED LINKEDIN]'));
  if (published) return 'published';
  const failed = matching.find((issue) => issue.title.startsWith('[FAILED LINKEDIN]'));
  if (failed) return 'failed';

  const latest = matching[0];
  if (latest.title.startsWith('[REJECTED LINKEDIN]')) return 'rejected';
  if (latest.title.startsWith('[APPROVED LINKEDIN]')) {
    if (latest.state === 'closed' && post.mode === 'draft') return 'approved';
    if (latest.state === 'closed') return 'scheduled';
    return 'approved';
  }
  return post.status || 'review';
}

async function fetchAllIssues() {
  const pages = [1, 2, 3];
  const responses = await Promise.all(pages.map(async (page) => {
    const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/issues?state=all&per_page=100&page=${page}`);
    if (!response.ok) throw new Error(`GitHub status ${response.status}`);
    return response.json();
  }));
  return responses.flat().filter((item) => !item.pull_request);
}

async function load() {
  elements.sync.textContent = 'Loading queue…';
  const queueResponse = await fetch('queue.json', { cache: 'no-store' });
  if (!queueResponse.ok) throw new Error('The review queue could not be loaded.');
  const queue = await queueResponse.json();
  state.posts = queue.posts;

  try {
    state.issues = await fetchAllIssues();
    elements.sync.textContent = `Audit refreshed ${new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date())}`;
  } catch (error) {
    elements.sync.textContent = 'Queue ready · GitHub audit unavailable';
  }

  state.posts = state.posts.map((post) => ({ ...post, resolvedStatus: statusFromIssues(post) }));
  populateCategories();
  applyFilters();
  updateMetrics();
}

function populateCategories() {
  const categories = [...new Set(state.posts.map((post) => post.category))].sort();
  const existing = new Set([...elements.category.options].map((option) => option.value));
  for (const category of categories) {
    if (existing.has(category)) continue;
    const option = document.createElement('option');
    option.value = category;
    option.textContent = displayCategory(category);
    elements.category.append(option);
  }
}

function applyFilters() {
  state.filtered = state.posts.filter((post) => {
    const categoryMatches = state.category === 'all' || post.category === state.category;
    const filterMatches = state.filter === 'all'
      || (state.filter === 'review' && ['draft', 'review'].includes(post.resolvedStatus))
      || (state.filter === 'decided' && !['draft', 'review'].includes(post.resolvedStatus));
    return categoryMatches && filterMatches;
  });
  state.index = Math.min(state.index, Math.max(0, state.filtered.length - 1));
  render();
}

function updateMetrics() {
  const counts = Object.fromEntries(STATUS_ORDER.map((status) => [status, 0]));
  for (const post of state.posts) counts[post.resolvedStatus] = (counts[post.resolvedStatus] || 0) + 1;
  document.querySelector('#metric-review').textContent = counts.draft + counts.review;
  document.querySelector('#metric-approved').textContent = counts.approved;
  document.querySelector('#metric-scheduled').textContent = counts.scheduled + counts.published;
  document.querySelector('#metric-rejected').textContent = counts.rejected + counts.failed;
}

function render() {
  renderCurrentPost();
  renderQueue();
  elements.position.textContent = state.filtered.length ? `${state.index + 1} of ${state.filtered.length}` : '0 of 0';
  elements.progress.style.width = state.filtered.length ? `${((state.index + 1) / state.filtered.length) * 100}%` : '0';
}

function createPostContent(post) {
  const fragment = elements.template.content.cloneNode(true);
  const primaryCopy = post.copy.default || post.copy[post.targets[0]];

  fragment.querySelector('.category-pill').textContent = displayCategory(post.category);
  const statePill = fragment.querySelector('.state-pill');
  statePill.textContent = post.resolvedStatus;
  statePill.dataset.state = post.resolvedStatus;
  fragment.querySelector('.post-id').textContent = `${post.id} · revision ${post.revision}`;
  fragment.querySelector('.copy-count').textContent = `${primaryCopy.length.toLocaleString('en-GB')} / 3,000 characters`;

  const scheduleList = fragment.querySelector('.schedule-list');
  for (const target of post.targets) {
    const schedule = formatDate(post.scheduledAt[target] || Object.values(post.scheduledAt)[0]);
    const row = document.createElement('div');
    row.className = 'schedule-row';
    const chip = document.createElement('span');
    chip.className = 'channel-chip';
    chip.textContent = CHANNEL_LABELS[target];
    const date = document.createElement('span');
    date.className = 'date-block';
    const datePrimary = document.createElement('strong');
    datePrimary.textContent = schedule.primary;
    const dateSecondary = document.createElement('small');
    dateSecondary.textContent = schedule.secondary;
    date.append(datePrimary, dateSecondary);
    row.append(chip, date);
    scheduleList.append(row);
  }

  const copyList = fragment.querySelector('.post-copy-list');
  const hasVariants = post.targets.some((target) => post.copy[target]);
  const copies = hasVariants
    ? post.targets.map((target) => ({ target, text: post.copy[target] || post.copy.default }))
    : [{ target: null, text: primaryCopy }];
  for (const copy of copies) {
    const section = document.createElement('section');
    section.className = 'copy-variant';
    if (copy.target) {
      const label = document.createElement('p');
      label.className = 'copy-label';
      label.textContent = `${CHANNEL_LABELS[copy.target]} copy`;
      section.append(label);
    }
    const body = document.createElement('div');
    body.className = 'post-copy';
    body.textContent = copy.text;
    section.append(body);
    copyList.append(section);
  }

  if (post.mediaPreviewUrl) {
    const media = fragment.querySelector('.media-preview');
    const image = media.querySelector('img');
    media.hidden = false;
    image.src = post.mediaPreviewUrl;
    image.alt = post.mediaAlt || `Media preview for ${post.title}`;
    media.querySelector('.media-label').textContent = post.format || 'Media preview';
  }
  return fragment;
}

function renderCurrentPost() {
  elements.card.replaceChildren();
  const post = state.filtered[state.index];
  if (!post) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = '<p><strong>Nothing is waiting here.</strong><br>Try another filter or refresh the audit.</p>';
    elements.card.append(empty);
    elements.controls.hidden = true;
    elements.swipeHint.hidden = true;
    return;
  }

  elements.card.append(createPostContent(post));
  const canDecide = ['draft', 'review', 'rejected', 'failed'].includes(post.resolvedStatus);
  elements.controls.hidden = !canDecide;
  elements.swipeHint.hidden = !canDecide;
}

function renderQueue() {
  elements.list.replaceChildren();
  state.filtered.forEach((post, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'queue-item';
    button.innerHTML = '<span class="queue-number"></span><span class="queue-summary"><strong></strong><small></small></span><span class="queue-state"></span>';
    button.querySelector('.queue-number').textContent = String(index + 1).padStart(2, '0');
    button.querySelector('strong').textContent = post.title;
    button.querySelector('small').textContent = `${displayCategory(post.category)} · ${post.targets.map((target) => CHANNEL_LABELS[target]).join(' + ')}`;
    button.querySelector('.queue-state').textContent = post.resolvedStatus;
    button.addEventListener('click', () => {
      state.index = index;
      render();
      elements.card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    elements.list.append(button);
  });
}

function issueBody(post, decision) {
  const lines = [
    `POST_ID: ${post.id}`,
    `REVISION: ${post.revision}`,
    `CATEGORY: ${post.category}`,
    `TARGETS: ${post.targets.join(',')}`,
  ];

  if (decision === 'approve') {
    lines.push(`MODE: ${post.mode}`);
    const schedules = Object.entries(post.scheduledAt);
    if (schedules.length === 1) lines.push(`SCHEDULE_AT: ${schedules[0][1]}`);
    else schedules.forEach(([target, value]) => lines.push(`SCHEDULE_AT_${target.toUpperCase()}: ${value}`));
    lines.push(`MEDIA_URL: ${post.mediaUrl || ''}`, '---', post.copy.default || '');
    for (const target of post.targets) {
      if (post.copy[target]) lines.push(`---${target.toUpperCase()}---`, post.copy[target]);
    }
  } else {
    lines.push('DECISION: rejected', '---', elements.rejectionNote.value.trim() || 'Please revise this post before it returns to the queue.');
  }
  return lines.join('\n');
}

function githubIssueUrl(post, decision) {
  const prefix = decision === 'approve' ? '[APPROVED LINKEDIN]' : '[REJECTED LINKEDIN]';
  const params = new URLSearchParams({
    title: `${prefix} ${post.id} — ${post.title}`,
    body: issueBody(post, decision),
  });
  return `https://github.com/${REPOSITORY}/issues/new?${params.toString()}`;
}

function openDecision(decision) {
  const post = state.filtered[state.index];
  if (!post) return;
  state.decision = decision;
  const approved = decision === 'approve';
  elements.sheetEyebrow.textContent = approved ? 'Explicit approval' : 'Revision route';
  elements.sheetTitle.textContent = approved ? 'Approve this exact version?' : 'Return this post for revision?';
  elements.sheetCopy.textContent = approved
    ? `${post.id} will target ${post.targets.map((target) => CHANNEL_LABELS[target]).join(' and ')} at the shown time.`
    : `${post.id} will be recorded as rejected. Buffer will not be contacted.`;
  elements.feedbackField.hidden = approved;
  elements.sheetAction.textContent = approved ? 'Approve and continue to GitHub' : 'Record NO in GitHub';
  elements.sheetAction.classList.toggle('reject', !approved);
  elements.safetyNote.textContent = approved
    ? 'Safety gate: the next page is a pre-filled GitHub approval record. Review it, then press “Submit new issue”. Only that final owner action can start the Buffer workflow.'
    : 'Rejection is safe: the record uses a different title and never triggers the Buffer workflow.';
  elements.sheet.showModal();
}

function commitDecision() {
  const post = state.filtered[state.index];
  if (!post || !state.decision) return;
  window.location.href = githubIssueUrl(post, state.decision);
}

document.querySelectorAll('.filter').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.filter').forEach((item) => item.classList.remove('is-active'));
    button.classList.add('is-active');
    state.filter = button.dataset.filter;
    state.index = 0;
    applyFilters();
  });
});

elements.category.addEventListener('change', () => {
  state.category = elements.category.value;
  state.index = 0;
  applyFilters();
});
elements.approve.addEventListener('click', () => openDecision('approve'));
elements.reject.addEventListener('click', () => openDecision('reject'));
elements.sheetAction.addEventListener('click', commitDecision);
elements.refresh.addEventListener('click', () => load().catch(showError));

let touchStart = null;
elements.card.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'mouse') return;
  touchStart = { x: event.clientX, y: event.clientY };
  elements.card.classList.add('swiping');
});
elements.card.addEventListener('pointermove', (event) => {
  if (!touchStart) return;
  const delta = event.clientX - touchStart.x;
  if (Math.abs(delta) < 10) return;
  elements.card.style.transform = `translateX(${delta * 0.34}px) rotate(${delta * 0.012}deg)`;
});
elements.card.addEventListener('pointerup', (event) => {
  if (!touchStart) return;
  const deltaX = event.clientX - touchStart.x;
  const deltaY = event.clientY - touchStart.y;
  elements.card.classList.remove('swiping');
  elements.card.style.transform = '';
  touchStart = null;
  if (Math.abs(deltaX) > 90 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4) {
    openDecision(deltaX > 0 ? 'approve' : 'reject');
  }
});
elements.card.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') openDecision('reject');
  if (event.key === 'ArrowRight') openDecision('approve');
});

function showError(error) {
  const wrapper = document.createElement('div');
  wrapper.className = 'empty-state';
  const message = document.createElement('p');
  const heading = document.createElement('strong');
  heading.textContent = 'We could not load the review desk.';
  message.append(heading, document.createElement('br'), document.createTextNode(error.message));
  wrapper.append(message);
  elements.card.replaceChildren(wrapper);
  elements.controls.hidden = true;
  elements.sync.textContent = 'Load failed';
}

load().catch(showError);
