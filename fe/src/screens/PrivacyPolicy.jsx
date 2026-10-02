import policyHtml from '../../../be/web/privacy-policy.html?raw';
import policyCss from '../../../be/web/privacy-policy.css?raw';

// The policy text and styling live in be/web/ and are the SAME files the Go
// backend serves at GET /privacy. Vite inlines them into the bundle at build
// time, so this screen needs no network and keeps working offline — which
// matters, because consent is required before sign-in.
//
// Editing be/web/privacy-policy.html updates the in-app screen and the public
// page together. There is no second copy.
//
// Props:
//   onBack — return to the previous screen

const BTN_BACK = {
  background: 'none', border: 'none', color: '#111', fontSize: 14,
  cursor: 'pointer', fontFamily: 'Verdana, sans-serif', padding: '4px 0',
};

const BTN_DONE = {
  width: '100%', marginTop: 32, padding: 12, borderRadius: 9, border: 'none',
  background: 'linear-gradient(135deg,#16a34a,#15803d)', color: '#fff',
  fontSize: 15, fontWeight: 700, fontFamily: 'Verdana, sans-serif',
  letterSpacing: 1, cursor: 'pointer', boxShadow: '0 4px 14px #0004',
};

export default function PrivacyPolicy({ onBack }) {
  return (
    <div className="ace-policy-page">
      {/* Shared stylesheet, scoped to .ace-policy* so it cannot leak. */}
      <style>{policyCss}</style>

      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <button onClick={onBack} style={BTN_BACK}>← Back</button>

        {/* First-party markup from the repo — never user input. */}
        <div dangerouslySetInnerHTML={{ __html: policyHtml }} />

        <button onClick={onBack} style={BTN_DONE}>Done</button>
      </div>
    </div>
  );
}
