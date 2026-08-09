'use strict';

const REPOSITORY = 'Chelston222/CGPT-1';
const GITHUB_AUDIT_TIMEOUT_MS = 5000;
const CHANNEL_LABELS = {
  personal: 'Chelston · Personal',
  main: '222 Emails · Main',
  secondary: 'TTE · Secondary',
};
const STATUS_ORDER = ['review', 'approved', 'rejected', 'scheduled', 'published', 'failed'];

const state = {
  posts: [],
  filtered: [],
  issues: [],
  index: 0,
  filter: 'review',
  category: 'all',
  decision: null,
  queue: null,
  decisions: {},
  weeks: [],
  weekIndex: 0,
};

const elements = {
  card: document.querySelector('#review-card'),
  template: document.querySelector('#post-template'),
  controls: document.querySelector('#decision-controls'),
  swipeHint: document.querySelector('#swipe-hint'),
  approve: document.querySelector('#approve-button'),
  reject: document.querySelector('#reject-button'),
  manualNext: document.querySelector('#manual-next'),
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
  previousWeek: document.querySelector('#previous-week'),
  nextWeek: document.querySelector('#next-week'),
  weekRange: document.querySelector('#week-range'),
  weekSummary: document.querySelector('#week-summary'),
  weekPersonal: document.querySelector('#week-personal'),
  weekMain: document.querySelector('#week-main'),
  weekSecondary: document.querySelector('#week-secondary'),
  weekTotal: document.querySelector('#week-total'),
  batchPanel: document.querySelector('#batch-panel'),
  batchStatus: document.querySelector('#batch-status'),
  sendWeek: document.querySelector('#send-week'),
  clearWeek: document.querySelector('#clear-week'),
};

function storageKey() {
  return `content-swiper:${REPOSITORY}:${state.queue?.generatedAt || 'unknown'}`;
}

function loadDecisions() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey()) || '{}');
    state.decisions = Object.fromEntries(Object.entries(saved).filter(([id, decision]) => {
      const post = state.posts.find((item) => item.id === id);
      return post && Number(decision.revision) === Number(post.revision);
    }));
  } catch {
    state.decisions = {};
  }
}

function saveDecisions() {
  localStorage.setItem(storageKey(), JSON.stringify(state.decisions));
}

function localDecision(post) {
  return state.decisions[post.id]?.decision || null;
}

function displayStatus(post) {
  if (post.resolvedStatus !== 'review') return post.resolvedStatus;
  return localDecision(post) === 'approve' ? 'yes selected' : localDecision(post) === 'reject' ? 'no selected' : 'review';
}

function displayCategory(category) {
  return String(category).split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function carouselIsPublishable(post) {
  return post.format !== 'carousel' || post.carousel?.readiness === 'ready';
}

function formatDate(value) {
  const date = new Date(value);
  return {
    primary: new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(date),
    secondary: new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(date),
  };
}

function dateOnly(value) {
  return String(value).slice(0, 10);
}

function addDays(value, days) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function weekStart(value) {
  const date = new Date(`${dateOnly(value)}T12:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

function weekLabel(start) {
  const end = addDays(start, 6);
  const startDate = new Date(`${start}T12:00:00Z`);
  const endDate = new Date(`${end}T12:00:00Z`);
  const startMonth = new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' }).format(startDate);
  const endMonth = new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' }).format(endDate);
  const year = endDate.getUTCFullYear();
  if (startMonth === endMonth) return `${startDate.getUTCDate()}–${endDate.getUTCDate()} ${endMonth} ${year}`;
  return `${startDate.getUTCDate()} ${startMonth}–${endDate.getUTCDate()} ${endMonth} ${year}`;
}

function scheduleIsInWeek(value, start) {
  const date = dateOnly(value);
  return date >= start && date <= addDays(start, 6);
}

function postIsInWeek(post, start) {
  return Object.values(post.scheduledAt).some((value) => scheduleIsInWeek(value, start));
}

function titleHasPostId(issue, postId) {
  const body = String(issue.body || '');
  if (issue.title.includes('LINKEDIN WEEK]')) {
    return batchLineHasPost(body, 'APPROVED_ITEMS', postId);
  }
  return issue.title.includes(postId) || body.includes(`POST_ID: ${postId}`);
}

function batchLineHasPost(body, field, postId) {
  const line = String(body || '').match(new RegExp(`^${field}:\\s*(.*)$`, 'im'))?.[1] || '';
  return line.split(',').some((item) => item.trim().startsWith(`${postId}@`));
}

function statusFromIssues(post) {
  const weeklyRejection = state.issues
    .filter((issue) => issue.title.includes('LINKEDIN WEEK]') && batchLineHasPost(issue.body, 'REJECTED_ITEMS', post.id))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  if (weeklyRejection) return 'rejected';

  const matching = state.issues
    .filter((issue) => titleHasPostId(issue, post.id) && !/^MODE:\s*draft$/im.test(String(issue.body || '')))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  if (!matching.length) return post.status || 'review';

  const published = matching.find((issue) => issue.title.startsWith('[PUBLISHED LINKEDIN]'));
  if (published) return 'published';
  const failed = matching.find((issue) => issue.title.startsWith('[FAILED LINKEDIN]') || issue.title.startsWith('[FAILED LINKEDIN WEEK]'));
  if (failed) return 'failed';

  const latest = matching[0];
  if (latest.title.startsWith('[REJECTED LINKEDIN]')) return 'rejected';
  if (latest.title.startsWith('[APPROVED LINKEDIN]') || latest.title.startsWith('[APPROVED LINKEDIN WEEK]')) {
    if (latest.state === 'closed') return 'scheduled';
    return 'approved';
  }
  return post.status || 'review';
}

async function fetchAllIssues() {
  const pages = [1, 2, 3];
  const responses = await Promise.all(pages.map(async (page) => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), GITHUB_AUDIT_TIMEOUT_MS);
    try {
      const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/issues?state=all&per_page=100&page=${page}`, { signal: controller.signal });
      if (!response.ok) throw new Error(`GitHub status ${response.status}`);
      return response.json();
    } finally {
      window.clearTimeout(timeout);
    }
  }));
  return responses.flat().filter((item) => !item.pull_request);
}

async function load() {
  elements.sync.textContent = 'Loading queue…';
  const queueResponse = await fetch('queue.json', { cache: 'no-store' });
  if (!queueResponse.ok) throw new Error('The review queue could not be loaded.');
  const queue = await queueResponse.json();
  state.queue = queue;
  state.posts = queue.posts;
  loadDecisions();

  try {
    state.issues = await fetchAllIssues();
    elements.sync.textContent = `Audit refreshed ${new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date())}`;
  } catch (error) {
    elements.sync.textContent = 'Queue ready · GitHub audit unavailable';
  }

  state.posts = state.posts.map((post) => ({ ...post, resolvedStatus: statusFromIssues(post) }));
  state.weeks = [...new Set(state.posts.flatMap((post) => Object.values(post.scheduledAt).map(weekStart)))].sort();
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
    const selectedWeek = state.weeks[state.weekIndex];
    const weekMatches = selectedWeek && postIsInWeek(post, selectedWeek);
    const categoryMatches = state.category === 'all' || post.category === state.category;
    const hasDecision = Boolean(localDecision(post));
    const filterMatches = state.filter === 'all'
      || (state.filter === 'review' && post.resolvedStatus === 'review' && !hasDecision)
      || (state.filter === 'decided' && (post.resolvedStatus !== 'review' || hasDecision));
    return weekMatches && categoryMatches && filterMatches;
  });
  state.index = Math.min(state.index, Math.max(0, state.filtered.length - 1));
  updateMetrics();
  render();
}

function updateMetrics() {
  const counts = Object.fromEntries(STATUS_ORDER.map((status) => [status, 0]));
  const selectedWeek = state.weeks[state.weekIndex];
  const weekPosts = state.posts.filter((post) => selectedWeek && postIsInWeek(post, selectedWeek));
  for (const post of weekPosts) {
    const decision = localDecision(post);
    if (post.resolvedStatus === 'review' && decision === 'approve') counts.approved += 1;
    else if (post.resolvedStatus === 'review' && decision === 'reject') counts.rejected += 1;
    else counts[post.resolvedStatus] = (counts[post.resolvedStatus] || 0) + 1;
  }
  document.querySelector('#metric-review').textContent = weekPosts.filter((post) => post.resolvedStatus === 'review' && !localDecision(post)).length;
  document.querySelector('#metric-approved').textContent = counts.approved;
  document.querySelector('#metric-scheduled').textContent = counts.scheduled + counts.published;
  document.querySelector('#metric-rejected').textContent = counts.rejected + counts.failed;
}

function render() {
  renderWeek();
  renderBatchPanel();
  renderCurrentPost();
  renderQueue();
  elements.position.textContent = state.filtered.length ? `${state.index + 1} of ${state.filtered.length}` : '0 of 0';
  elements.progress.style.width = state.filtered.length ? `${((state.index + 1) / state.filtered.length) * 100}%` : '0';
}

function renderWeek() {
  const selectedWeek = state.weeks[state.weekIndex];
  if (!selectedWeek) {
    elements.weekRange.textContent = 'No scheduled weeks';
    elements.weekSummary.textContent = 'Add a live-ready post to start the calendar.';
    elements.previousWeek.disabled = true;
    elements.nextWeek.disabled = true;
    return;
  }

  const weekPosts = state.posts.filter((post) => postIsInWeek(post, selectedWeek));
  const counts = { personal: 0, main: 0, secondary: 0 };
  for (const post of weekPosts) {
    for (const target of post.targets) {
      if (scheduleIsInWeek(post.scheduledAt[target] || Object.values(post.scheduledAt)[0], selectedWeek)) counts[target] += 1;
    }
  }
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  elements.weekRange.textContent = weekLabel(selectedWeek);
  elements.weekSummary.textContent = `Week ${state.weekIndex + 1} of ${state.weeks.length} · ${weekPosts.length} content ${weekPosts.length === 1 ? 'decision' : 'decisions'} · ${total} account ${total === 1 ? 'placement' : 'placements'}`;
  elements.weekPersonal.textContent = counts.personal;
  elements.weekMain.textContent = counts.main;
  elements.weekSecondary.textContent = counts.secondary;
  elements.weekTotal.textContent = total;
  elements.previousWeek.disabled = state.weekIndex === 0;
  elements.nextWeek.disabled = state.weekIndex === state.weeks.length - 1;
}

function weekDecisionSummary() {
  const selectedWeek = state.weeks[state.weekIndex];
  const posts = state.posts.filter((post) => selectedWeek && postIsInWeek(post, selectedWeek) && post.resolvedStatus === 'review');
  const yes = posts.filter((post) => localDecision(post) === 'approve');
  const no = posts.filter((post) => localDecision(post) === 'reject');
  const remaining = posts.filter((post) => !localDecision(post));
  return { posts, yes, no, remaining };
}

function renderBatchPanel() {
  const summary = weekDecisionSummary();
  elements.batchPanel.hidden = !state.weeks[state.weekIndex] || !summary.posts.length;
  elements.batchStatus.textContent = `${summary.yes.length} YES · ${summary.no.length} NO · ${summary.remaining.length} to decide`;
  elements.sendWeek.disabled = summary.remaining.length > 0 || summary.yes.length === 0;
  elements.sendWeek.textContent = summary.remaining.length
    ? `Decide ${summary.remaining.length} more`
    : summary.yes.length ? `Send ${summary.yes.length} approved ${summary.yes.length === 1 ? 'post' : 'posts'}` : 'Nothing approved';
  elements.clearWeek.disabled = summary.yes.length + summary.no.length === 0;
}

function createPostContent(post) {
  const fragment = elements.template.content.cloneNode(true);
  const primaryCopy = post.copy.default || post.copy[post.targets[0]];

  fragment.querySelector('.category-pill').textContent = displayCategory(post.category);
  const statePill = fragment.querySelector('.state-pill');
  statePill.textContent = displayStatus(post);
  statePill.dataset.state = localDecision(post) || post.resolvedStatus;
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
    media.querySelector('.media-label').textContent = post.carousel
      ? `Carousel ${post.carousel.libraryId} · ${post.carousel.slideCount} promoted slides`
      : post.format || 'Media preview';
  }
  if (post.carousel) {
    const readiness = fragment.querySelector('.media-readiness');
    readiness.hidden = false;
    readiness.dataset.ready = String(carouselIsPublishable(post));
    readiness.textContent = carouselIsPublishable(post)
      ? 'Carousel PDF is attached and included in the approval lock.'
      : 'Carousel source is matched and promoted. YES unlocks only after its publishable PDF has been verified.';
  }
  return fragment;
}

function renderCurrentPost() {
  elements.card.replaceChildren();
  const post = state.filtered[state.index];
  if (!post) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    const summary = weekDecisionSummary();
    empty.innerHTML = summary.posts.length && !summary.remaining.length
      ? '<p><strong>This week is fully decided.</strong><br>Check the weekly summary, then send all YES selections together.</p>'
      : '<p><strong>Nothing is waiting here.</strong><br>Try another filter or refresh the audit.</p>';
    elements.card.append(empty);
    elements.controls.hidden = true;
    elements.manualNext.hidden = true;
    elements.swipeHint.hidden = true;
    return;
  }

  elements.card.append(createPostContent(post));
  const canDecide = ['review', 'rejected', 'failed'].includes(post.resolvedStatus);
  elements.controls.hidden = !canDecide;
  elements.approve.disabled = !carouselIsPublishable(post);
  elements.approve.title = carouselIsPublishable(post) ? '' : 'This carousel still needs its verified PDF attachment.';
  elements.manualNext.hidden = false;
  elements.manualNext.disabled = state.filtered.length < 2;
  elements.swipeHint.hidden = !canDecide;
}

function showNextWithoutDecision() {
  if (state.filtered.length < 2) return;
  state.index = (state.index + 1) % state.filtered.length;
  render();
  elements.card.focus({ preventScroll: true });
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
    button.querySelector('.queue-state').textContent = displayStatus(post);
    button.addEventListener('click', () => {
      state.index = index;
      render();
      elements.card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    elements.list.append(button);
  });
}

function weeklyIssueUrl() {
  const selectedWeek = state.weeks[state.weekIndex];
  const summary = weekDecisionSummary();
  const approved = summary.yes.map((post) => `${post.id}@${post.revision}`).join(',');
  const rejected = summary.no.map((post) => `${post.id}@${post.revision}`).join(',');
  const body = [
    `BATCH_ID: 222-linkedin-week-${selectedWeek}`,
    `WEEK_START: ${selectedWeek}`,
    `QUEUE_SCHEMA: ${state.queue.schemaVersion}`,
    `QUEUE_GENERATED_AT: ${state.queue.generatedAt}`,
    `APPROVED_ITEMS: ${approved}`,
    `REJECTED_ITEMS: ${rejected}`,
    `DECISION_AT: ${new Date().toISOString()}`,
    '---',
    'I explicitly approve only the locked APPROVED_ITEMS above for their exact copy, target channels and scheduled times in queue.json. Rejected items must not be sent to Buffer.',
  ].join('\n');
  const params = new URLSearchParams({
    title: `[APPROVED LINKEDIN WEEK] ${selectedWeek} — ${summary.yes.length} approved`,
    body,
  });
  return `https://github.com/${REPOSITORY}/issues/new?${params.toString()}`;
}

function openDecision(decision) {
  const post = state.filtered[state.index];
  if (!post) return;
  if (decision === 'approve' && !carouselIsPublishable(post)) return;
  state.decision = decision;
  const approved = decision === 'approve';
  elements.sheetEyebrow.textContent = approved ? 'YES selection' : 'Revision route';
  elements.sheetTitle.textContent = approved ? 'Add this exact version to YES?' : 'Return this post for revision?';
  elements.sheetCopy.textContent = approved
    ? `${post.id} will be included in the weekly approval. The next post will appear immediately.`
    : `${post.id} will be held for revision. The next post will appear immediately.`;
  elements.feedbackField.hidden = approved;
  elements.sheetAction.textContent = approved ? 'Save YES · show next' : 'Save NO · show next';
  elements.sheetAction.classList.toggle('reject', !approved);
  elements.safetyNote.textContent = approved
    ? 'This saves only on this device. Buffer is contacted only after every item is decided and you submit the single weekly GitHub approval.'
    : 'NO never contacts Buffer. Your note stays with this device for the revision pass.';
  elements.sheet.showModal();
}

function commitDecision() {
  const post = state.filtered[state.index];
  if (!post || !state.decision) return;
  state.decisions[post.id] = {
    decision: state.decision,
    note: state.decision === 'reject' ? elements.rejectionNote.value.trim() : '',
    revision: post.revision,
    at: new Date().toISOString(),
  };
  saveDecisions();
  elements.sheet.close();
  elements.rejectionNote.value = '';
  elements.card.classList.add(state.decision === 'approve' ? 'exit-right' : 'exit-left');
  state.decision = null;
  setTimeout(() => {
    elements.card.classList.remove('exit-right', 'exit-left');
    state.index = 0;
    applyFilters();
    elements.card.focus({ preventScroll: true });
  }, 190);
}

function openWeeklySend() {
  const selectedWeek = state.weeks[state.weekIndex];
  const summary = weekDecisionSummary();
  if (!selectedWeek || summary.remaining.length || !summary.yes.length) return;
  state.decision = 'send_week';
  elements.sheetEyebrow.textContent = 'Final weekly approval';
  elements.sheetTitle.textContent = `Send ${summary.yes.length} YES ${summary.yes.length === 1 ? 'post' : 'posts'} to GitHub?`;
  elements.sheetCopy.textContent = `${weekLabel(selectedWeek)} · ${summary.yes.reduce((total, post) => total + post.targets.length, 0)} Buffer destinations. ${summary.no.length} NO selections stay out.`;
  elements.feedbackField.hidden = true;
  elements.sheetAction.textContent = 'Open one weekly approval';
  elements.sheetAction.classList.remove('reject');
  elements.safetyNote.textContent = 'GitHub will show one compact, locked weekly record. Check it and press “Submit new issue”. That final owner action starts scheduling after the complete week passes preflight.';
  elements.sheet.showModal();
}

function commitSheetAction() {
  if (state.decision === 'send_week') {
    window.location.href = weeklyIssueUrl();
    return;
  }
  commitDecision();
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
elements.previousWeek.addEventListener('click', () => {
  if (state.weekIndex === 0) return;
  state.weekIndex -= 1;
  state.index = 0;
  applyFilters();
});
elements.nextWeek.addEventListener('click', () => {
  if (state.weekIndex >= state.weeks.length - 1) return;
  state.weekIndex += 1;
  state.index = 0;
  applyFilters();
});
elements.approve.addEventListener('click', () => openDecision('approve'));
elements.reject.addEventListener('click', () => openDecision('reject'));
elements.manualNext.addEventListener('click', showNextWithoutDecision);
elements.sheetAction.addEventListener('click', commitSheetAction);
elements.sendWeek.addEventListener('click', openWeeklySend);
elements.clearWeek.addEventListener('click', () => {
  const selectedWeek = state.weeks[state.weekIndex];
  if (!selectedWeek || !window.confirm(`Clear your saved YES/NO choices for ${weekLabel(selectedWeek)}?`)) return;
  for (const post of state.posts.filter((item) => postIsInWeek(item, selectedWeek))) delete state.decisions[post.id];
  saveDecisions();
  state.index = 0;
  applyFilters();
});
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
  if (event.key.toLowerCase() === 'n') showNextWithoutDecision();
});

function showError(error) {
  const wrapper = document.createElement('div');
  wrapper.className = 'empty-state';
  const message = document.createElement('p');
  const heading = document.createElement('strong');
  heading.textContent = 'We could not load the Content Swiper.';
  message.append(heading, document.createElement('br'), document.createTextNode(error.message));
  wrapper.append(message);
  elements.card.replaceChildren(wrapper);
  elements.controls.hidden = true;
  elements.manualNext.hidden = true;
  elements.sync.textContent = 'Load failed';
}

load().catch(showError);
