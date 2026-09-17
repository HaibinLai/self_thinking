/* Structured-selection engine.
 * Browser: window.CaseboardStructure
 * Node tests: require('./structure.js')
 *
 * Future integration point:
 *   async function buildDraftWithLLM(input) { ...same draft schema... }
 */
(function initCaseboardStructure(root) {
  'use strict';

  const WORLD_SCALE = '世界问题';
  const DEFAULT_KIND = '问题';
  const STOP_WORDS = new Set([
    '的', '了', '和', '与', '及', '或', '在', '是', '有', '对', '从', '为', '中', '这', '那',
    '一个', '一种', '什么', '如何', '为什么', '是否', '可能', '需要', '问题', '线索', '观察',
    'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'is', 'are', 'why',
    'how', 'what', 'this', 'that', 'from', 'by', 'as', 'at', 'it',
  ]);

  // Parallel keys are intentionally kept here until structure.* is merged into i18n.js.
  const COPY = {
    zh: {
      selected: '共选择 {n} 张卡片，涵盖 {scales}。',
      linked: '其中 {n} 条现有连线构成了这组材料的内部关系。',
      unlinked: '这些卡片之间还没有现有连线，当前更像一组待验证的并置线索。',
      center: '“{title}”是选中子图中连接最多的节点，可作为结构化入口。',
      notes: '{n} 张卡片已有批注，可用于区分事实、判断与待问问题。',
      question: '这些线索如何共同解释“{topics}”？',
      questionFallback: '这些线索共同指向了什么更大的世界问题？',
      note: '由所选卡片归纳出的世界问题草稿：{titles}',
      instruction: '用户意图：{instruction}',
      reason: '将“{title}”纳入上位问题',
      gapLinks: '选中卡片之间缺少连线；建议先确认哪些关系是因果、支持或冲突。',
      gapEvidence: '所选内容缺少「观察 / 证据」层卡片；建议补充可核验材料。',
      gapJudgment: '所选内容缺少「研究判断」层卡片；建议补写一个可被反驳的判断。',
      gapNotes: '部分卡片标题或批注较少；结构化前可先补一句它与主题的关系。',
      mixed: '多个思想尺度',
      unknown: '未标注尺度',
    },
    en: {
      selected: '{n} cards selected, spanning {scales}.',
      linked: '{n} existing links form the internal relationships in this selection.',
      unlinked: 'The selected cards have no existing links and currently read as juxtaposed leads to verify.',
      center: '“{title}” is the most connected node in the selected subgraph and can anchor the structure.',
      notes: '{n} cards include notes that can help separate facts, judgments, and open questions.',
      question: 'How do these clues jointly explain “{topics}”?',
      questionFallback: 'What larger world problem do these clues point to?',
      note: 'Draft world problem synthesized from the selected cards: {titles}',
      instruction: 'User intent: {instruction}',
      reason: 'Place “{title}” under the broader question',
      gapLinks: 'The selected cards are not linked; first identify which relationships are causal, supporting, or conflicting.',
      gapEvidence: 'No observation/evidence card is selected; add verifiable material.',
      gapJudgment: 'No research-judgment card is selected; add a falsifiable claim.',
      gapNotes: 'Some cards have little title or note content; add one sentence about how each relates to the theme.',
      mixed: 'multiple thinking scales',
      unknown: 'unlabeled scale',
    },
  };

  function format(template, vars) {
    return Object.keys(vars || {}).reduce(
      (text, key) => text.split(`{${key}}`).join(String(vars[key])),
      template,
    );
  }

  function msg(lang, key, vars) {
    const fallback = COPY[lang][key] || COPY.zh[key] || key;
    const i18n = root && root.CaseboardI18n;
    if (i18n && typeof i18n.t === 'function') {
      const translated = i18n.t(lang, `structure.${key}`, vars);
      if (translated && translated !== `structure.${key}`) return translated;
    }
    return format(fallback, vars);
  }

  function cardText(card) {
    return `${card && card.title ? card.title : ''} ${card && card.note ? card.note : ''}`.trim();
  }

  function detectLanguage(cards, instruction) {
    const text = `${cards.map(cardText).join(' ')} ${instruction || ''}`;
    const latin = (text.match(/[A-Za-z]/g) || []).length;
    const han = (text.match(/[\u3400-\u9fff]/g) || []).length;
    return latin > han * 1.5 ? 'en' : 'zh';
  }

  function extractTopics(cards, lang) {
    const counts = new Map();
    cards.forEach((card) => {
      const source = cardText(card).toLowerCase();
      const tokens = lang === 'en'
        ? source.match(/[a-z][a-z0-9-]{2,}/g) || []
        : source.match(/[\u3400-\u9fff]{2,8}|[a-z][a-z0-9-]{2,}/g) || [];
      tokens.forEach((token) => {
        if (!STOP_WORDS.has(token)) counts.set(token, (counts.get(token) || 0) + 1);
      });
    });
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length || a[0].localeCompare(b[0]))
      .slice(0, 3)
      .map(([token]) => token);
  }

  function normalizeLink(link) {
    if (Array.isArray(link)) return { from: link[0], to: link[1] };
    return link || {};
  }

  function buildDraft(input) {
    const source = input || {};
    const cards = Array.isArray(source.cards) ? source.cards.filter(Boolean) : [];
    const links = Array.isArray(source.links) ? source.links.map(normalizeLink) : [];
    const instruction = typeof source.instruction === 'string' ? source.instruction.trim() : '';
    const lang = detectLanguage(cards, instruction);
    const ids = new Set(cards.map((card) => card.id).filter(Boolean));
    const internalLinks = links.filter((link) => ids.has(link.from) && ids.has(link.to));
    const degree = new Map(cards.map((card) => [card.id, 0]));
    internalLinks.forEach((link) => {
      degree.set(link.from, (degree.get(link.from) || 0) + 1);
      degree.set(link.to, (degree.get(link.to) || 0) + 1);
    });
    const ranked = cards.slice().sort((a, b) => {
      const degreeDiff = (degree.get(b.id) || 0) - (degree.get(a.id) || 0);
      if (degreeDiff) return degreeDiff;
      const contentDiff = cardText(b).length - cardText(a).length;
      return contentDiff || String(a.id || '').localeCompare(String(b.id || ''));
    });
    const scales = [...new Set(cards.map((card) => card.cardScale).filter(Boolean))];
    const scaleSummary = scales.length > 2 ? msg(lang, 'mixed') : scales.join('、') || msg(lang, 'unknown');
    const summary = [
      msg(lang, 'selected', { n: cards.length, scales: scaleSummary }),
      internalLinks.length
        ? msg(lang, 'linked', { n: internalLinks.length })
        : msg(lang, 'unlinked'),
    ];
    const center = ranked[0];
    if (center && (degree.get(center.id) || 0) > 0) {
      summary.push(msg(lang, 'center', { title: center.title || center.id }));
    } else {
      const noted = cards.filter((card) => card.note && card.note.trim()).length;
      if (noted) summary.push(msg(lang, 'notes', { n: noted }));
    }

    const topics = extractTopics(cards, lang);
    const titles = ranked.slice(0, 4).map((card) => card.title).filter(Boolean);
    const questionTitle = topics.length
      ? msg(lang, 'question', { topics: topics.join(lang === 'en' ? ', ' : '、') })
      : msg(lang, 'questionFallback');
    const noteParts = [msg(lang, 'note', { titles: titles.join(lang === 'en' ? '; ' : '；') || '—' })];
    if (instruction) noteParts.push(msg(lang, 'instruction', { instruction }));

    const questionTempId = 'structure-world-1';
    const proposedCards = cards.length ? [{
      tempId: questionTempId,
      cardScale: WORLD_SCALE,
      kind: DEFAULT_KIND,
      title: questionTitle,
      note: noteParts.join('\n'),
      selected: true,
    }] : [];
    const proposedLinks = ranked.slice(0, Math.min(3, ranked.length)).map((card, index) => ({
      tempId: `structure-link-${index + 1}`,
      from: card.id,
      to: questionTempId,
      reason: msg(lang, 'reason', { title: card.title || card.id }),
      selected: true,
    })).filter((link) => link.from);

    const gaps = [];
    if (cards.length > 1 && !internalLinks.length) gaps.push(msg(lang, 'gapLinks'));
    if (!cards.some((card) => /观察|证据|observation|evidence/i.test(card.cardScale || card.kind || ''))) {
      gaps.push(msg(lang, 'gapEvidence'));
    }
    if (!cards.some((card) => /研究判断|research judgment/i.test(card.cardScale || ''))) {
      gaps.push(msg(lang, 'gapJudgment'));
    }
    if (cards.some((card) => cardText(card).length < 6)) gaps.push(msg(lang, 'gapNotes'));

    return {
      summary: summary.slice(0, 4),
      proposedCards,
      proposedLinks,
      ...(gaps.length ? { gaps } : {}),
    };
  }

  function createId(existingIds) {
    let id;
    do {
      if (root && root.crypto && typeof root.crypto.randomUUID === 'function') {
        id = root.crypto.randomUUID();
      } else {
        id = `structure-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
      }
    } while (existingIds.has(id));
    existingIds.add(id);
    return id;
  }

  function selectionPredicate(selectedIds) {
    if (!Array.isArray(selectedIds)) return (item) => item.selected !== false;
    const selected = new Set(selectedIds);
    return (item, index, type) => selected.has(item.tempId)
      || selected.has(`${type}:${index}`)
      || (type === 'link' && selected.has(`${item.from}->${item.to}`));
  }

  function applyDraft(state, draft, selectedIds) {
    if (!state || typeof state !== 'object') throw new TypeError('state must be an object');
    if (!Array.isArray(state.cards)) state.cards = [];
    if (!Array.isArray(state.links)) state.links = [];

    const cards = Array.isArray(draft && draft.proposedCards) ? draft.proposedCards : [];
    const links = Array.isArray(draft && draft.proposedLinks) ? draft.proposedLinks : [];
    const isSelected = selectionPredicate(selectedIds);
    const existingIds = new Set(state.cards.map((card) => card.id));
    const tempToReal = new Map();
    const anchors = state.cards.filter((card) => !selectedIds || selectedIds.includes(card.id));
    const baseX = anchors.length
      ? anchors.reduce((sum, card) => sum + (Number(card.x) || 0), 0) / anchors.length
      : 120;
    const baseY = anchors.length
      ? anchors.reduce((sum, card) => sum + (Number(card.y) || 0), 0) / anchors.length
      : 120;
    let nextZ = state.cards.reduce((max, card) => Math.max(max, Number(card.z) || 0), 0) + 1;
    const addedCards = [];

    cards.forEach((proposal, index) => {
      if (!proposal || !isSelected(proposal, index, 'card')) return;
      const id = createId(existingIds);
      const card = {
        id,
        kind: proposal.kind || DEFAULT_KIND,
        cardScale: proposal.cardScale || WORLD_SCALE,
        title: String(proposal.title || ''),
        note: String(proposal.note || ''),
        x: Number.isFinite(proposal.x) ? proposal.x : baseX + 180 + index * 28,
        y: Number.isFinite(proposal.y) ? proposal.y : baseY - 70 + index * 28,
        tilt: proposal.tilt || '0deg',
        z: nextZ++,
      };
      state.cards.push(card);
      addedCards.push(card);
      if (proposal.tempId) tempToReal.set(proposal.tempId, id);
    });

    const hasEndpoint = (id) => existingIds.has(id);
    const addedLinks = [];
    links.forEach((proposal, index) => {
      if (!proposal || !isSelected(proposal, index, 'link')) return;
      const from = tempToReal.get(proposal.from) || proposal.from;
      const to = tempToReal.get(proposal.to) || proposal.to;
      if (!from || !to || from === to || !hasEndpoint(from) || !hasEndpoint(to)) return;
      const duplicate = state.links.some((rawLink) => {
        const link = normalizeLink(rawLink);
        return link.from === from && link.to === to;
      });
      if (duplicate) return;
      const link = {
        from,
        to,
        marker: 'none',
        width: Number(proposal.width) || Number(state.lineWidth) || 2,
        color: proposal.color || state.lineColor || '#d95650',
      };
      state.links.push(link);
      addedLinks.push(link);
    });

    return { addedCards, addedLinks };
  }

  const api = { buildDraft, applyDraft };
  if (root) root.CaseboardStructure = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
