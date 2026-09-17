const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDraft, applyDraft } = require('./structure.js');

test('buildDraft returns a world-question draft without mutating input', () => {
  const cards = [
    { id: 'a', kind: '观察', cardScale: '观察 / 证据', title: '河流水位上升', note: '连续三年提前进入汛期' },
    { id: 'b', kind: '推断', cardScale: '研究判断', title: '极端降雨增加', note: '可能改变城市排水风险' },
  ];
  const links = [{ from: 'a', to: 'b', marker: 'arrow' }];
  const before = JSON.stringify({ cards, links });
  const draft = buildDraft({ cards, links, instruction: '结构化气候风险' });

  assert.equal(JSON.stringify({ cards, links }), before);
  assert.equal(draft.proposedCards.length, 1);
  assert.equal(draft.proposedCards[0].cardScale, '世界问题');
  assert.equal(draft.proposedLinks[0].to, draft.proposedCards[0].tempId);
  assert.ok(draft.proposedLinks.every((link) => ['a', 'b'].includes(link.from)));
  assert.ok(draft.summary.length >= 2 && draft.summary.length <= 4);
});

test('applyDraft applies only checked additions and preserves original data', () => {
  const state = {
    cards: [{ id: 'a', title: '原卡', x: 10, y: 20, z: 1 }],
    links: [],
    lineWidth: 3,
    lineColor: '#123456',
  };
  const draft = {
    proposedCards: [
      { tempId: 'world', title: '上位问题', note: '草稿', selected: true },
      { tempId: 'unchecked', title: '不应添加', selected: true },
    ],
    proposedLinks: [
      { tempId: 'edge', from: 'a', to: 'world', selected: true },
      { tempId: 'bad-edge', from: 'a', to: 'unchecked', selected: true },
    ],
  };

  const result = applyDraft(state, draft, ['world', 'edge']);

  assert.equal(state.cards[0].id, 'a');
  assert.equal(result.addedCards.length, 1);
  assert.equal(result.addedCards[0].cardScale, '世界问题');
  assert.equal(result.addedLinks.length, 1);
  assert.deepEqual(result.addedLinks[0], {
    from: 'a',
    to: result.addedCards[0].id,
    marker: 'none',
    width: 3,
    color: '#123456',
  });
});

test('an explicit empty selection applies nothing', () => {
  const state = { cards: [], links: [] };
  const draft = {
    proposedCards: [{ tempId: 'world', title: '草稿', selected: true }],
    proposedLinks: [],
  };

  assert.deepEqual(applyDraft(state, draft, []), { addedCards: [], addedLinks: [] });
  assert.deepEqual(state, { cards: [], links: [] });
});
