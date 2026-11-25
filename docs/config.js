/* CodeTrack front-end settings.
 * apiUrl: your Apps Script web app URL (Deploy > Manage deployments > Web app URL, ends in /exec).
 * proctor: turn on camera + microphone checks during sectioned exams (photos go to Drive).
 * reviewPinHash: SHA-256 of "ctp|<PIN>" for the on-device review page (<site>#review).
 */
window.CODETRACK_CONFIG = {
  apiUrl: 'https://script.google.com/macros/s/AKfycbw-19S3PMFzT7JrXCopO9VCjoY-Ari7A6k36qO8IZNZQFPkaGIYxdtQV9YrOpPZuWRNCg/exec',
  proctor: true,
  reviewPinHash: '57ea7ff1c0378324f7cfd76e80ac451f6b06d97ae831714d8d1fcf196c084f41'
};
