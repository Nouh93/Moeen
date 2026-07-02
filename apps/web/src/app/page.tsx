export default function HomePage() {
  return (
    <div>
      <h1>أهلاً بك في مُعين</h1>
      <p className="muted">منصة تجارة وتوصيل مصمّمة لليمن — متاجر، طلبات، توصيل، ومحفظة تاجر بمنطق مالي دقيق.</p>

      <div className="card">
        <h2>هل أنت تاجر؟</h2>
        <p className="muted">سجّل دخولك لإدارة متجرك، منتجاتك، محفظتك، وطلباتك.</p>
        <div className="row">
          <a href="/login">
            <button>دخول التاجر</button>
          </a>
          <a href="/register">
            <button className="secondary">تسجيل متجر جديد</button>
          </a>
        </div>
      </div>

      <div className="card">
        <h2>هل أنت زبون؟</h2>
        <p className="muted">
          افتح رابط المتجر الذي شاركه معك التاجر لتصفّح المنتجات والطلب. كل متجر له
          صفحته الخاصة.
        </p>
      </div>
    </div>
  );
}
