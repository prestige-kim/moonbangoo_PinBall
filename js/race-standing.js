(function (P) {
  'use strict';
  // Equal progress is a joint live place, not an input-order advantage.
  // This presentation never changes race ordering or finish-time tie breakers.
  P.raceStanding = function (ranking) {
    var ranks = [], anchor = null;
    for (var i = 0; i < ranking.length; i++) {
      var marble = ranking[i];
      var tied = anchor && !anchor.finished && !marble.finished && Math.abs(anchor.y - marble.y) <= 1e-7;
      ranks.push(tied ? ranks[i - 1] : i + 1);
      if (!tied) anchor = marble;
    }
    return { ranks: ranks, leader: ranking.length && (ranking[0].finished || ranking.length === 1 || ranks[1] !== 1) ? ranking[0] : null };
  };
})(window.CosmicPinball);
