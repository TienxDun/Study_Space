import type { Metadata } from "next";
import Link from "next/link";
import { DeleteAccountPanel } from "./DeleteAccountPanel";

export const metadata: Metadata = {
  title: "Xoá tài khoản",
  description:
    "Cách xoá tài khoản ZenStudy Space và toàn bộ dữ liệu đi kèm: ghi chú, việc cần làm, thống kê tập trung, lịch sử trò chuyện AI và dữ liệu phòng học nhóm.",
  alternates: { canonical: "/account-deletion/" },
  robots: { index: true, follow: true },
};

const UPDATED_AT = "29/10/2026";
const CONTACT_EMAIL = "leutiendung.htt@gmail.com";

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6">
      <h2
        id={`${id}-title`}
        className="text-base sm:text-lg font-bold text-white tracking-tight"
      >
        {title}
      </h2>
      <div className="mt-2 space-y-2.5 text-sm leading-relaxed text-slate-300">
        {children}
      </div>
    </section>
  );
}

export default function AccountDeletionPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-8 sm:py-12">
      <Link
        href="/privacy/"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
      >
        <span aria-hidden="true">←</span>
        Về Chính sách quyền riêng tư
      </Link>

      <header className="mt-5 space-y-3">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white text-balance">
          Xoá tài khoản ZenStudy Space
        </h1>
        <p className="text-sm text-slate-400">
          Áp dụng cho website{" "}
          <span className="text-slate-200 font-medium">zenstudy.space</span> và ứng dụng
          Android <span className="text-slate-200 font-medium">ZenStudy Space</span> do
          Lều Tiến Dũng phát triển.
        </p>
        <p className="text-xs text-slate-500 font-mono">
          Cập nhật lần cuối: {UPDATED_AT}
        </p>
      </header>

      <div className="mt-6 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">
          Tóm tắt
        </p>
        <ul className="mt-2 space-y-1.5 text-sm text-slate-200 list-disc pl-5 marker:text-emerald-300">
          <li>Xoá được cả trong ứng dụng và ngay trên trang này.</li>
          <li>Xoá vĩnh viễn, không thể khôi phục.</li>
          <li>Tài khoản Google của bạn không bị xoá.</li>
          <li>Dữ liệu trên máy chủ được xoá ngay, không chờ 30 ngày.</li>
        </ul>
      </div>

      <article className="mt-8 space-y-8">
        <Section id="xoa-trong-app" title="1. Xoá trong ứng dụng">
          <ol className="list-decimal pl-5 space-y-1.5 marker:text-slate-500">
            <li>
              Mở ZenStudy, bấm ảnh đại diện ở góc trên bên phải (máy tính) hoặc mở tab{" "}
              <span className="text-slate-200 font-medium">Thêm</span> → mục{" "}
              <span className="text-slate-200 font-medium">Tài khoản</span> (điện thoại).
            </li>
            <li>Chọn &ldquo;Xoá tài khoản&rdquo;.</li>
            <li>Tích ô xác nhận rồi bấm &ldquo;Xoá vĩnh viễn&rdquo;.</li>
          </ol>
          <p>
            Ứng dụng xoá lịch sử trò chuyện trước, sau đó xoá dữ liệu đồng bộ và tài
            khoản đăng nhập trên máy chủ, cuối cùng dọn dữ liệu trên thiết bị. Bạn không
            cần chọn lại tài khoản Google.
          </p>
        </Section>

        <Section id="xoa-tren-web" title="2. Xoá ngay trên trang này">
          <p>
            Không cần cài ứng dụng. Đăng nhập bằng đúng tài khoản Google đã dùng cho
            ZenStudy rồi xác nhận xoá:
          </p>
          <DeleteAccountPanel />
        </Section>

        <Section id="du-lieu-bi-xoa" title="3. Dữ liệu bị xoá">
          <ul className="list-disc pl-5 space-y-1 marker:text-slate-500">
            <li>
              Tài khoản Firebase: mã định danh, email, tên hiển thị và ảnh đại diện do
              Google cung cấp khi đăng nhập.
            </li>
            <li>
              Bản đồng bộ trên Cloudflare D1: cài đặt không gian học, ghi chú, việc cần
              làm, cảnh yêu thích, liên kết nhúng và thống kê phiên tập trung.
            </li>
            <li>Số lượt hỏi trợ lý AI theo ngày (dùng để giới hạn sử dụng).</li>
            <li>
              Lịch sử trò chuyện AI trên Firebase Firestore: tên đoạn chat, tin nhắn và
              ảnh thu nhỏ của tệp đính kèm.
            </li>
            <li>
              Dữ liệu phòng học nhóm: tư cách chủ phòng/đồng host, tên hiển thị và thời
              điểm vào/ra phòng, nhật ký thao tác phòng do bạn thực hiện.
            </li>
            <li>
              Dữ liệu trên thiết bị hoặc trình duyệt đang dùng: localStorage, cache trò
              chuyện và cache Firestore.
            </li>
          </ul>
        </Section>

        <Section id="du-lieu-giu-lai" title="4. Dữ liệu được giữ lại">
          <ul className="list-disc pl-5 space-y-1 marker:text-slate-500">
            <li>
              Tài khoản Google: do Google quản lý, không nằm trong phạm vi xoá của
              ZenStudy.
            </li>
            <li>
              Số phút sử dụng phòng học nhóm tổng hợp theo tháng: không gắn với UID hay
              email, chỉ dùng để theo dõi hạn mức hạ tầng.
            </li>
            <li>
              Nhật ký lỗi kỹ thuật của hạ tầng (Cloudflare, Firebase, LiveKit): tối đa
              14 ngày, không chứa nội dung ghi chú hay trò chuyện.
            </li>
            <li>
              Bản ghi tối thiểu mà pháp luật yêu cầu phải lưu (nếu có), chỉ dùng cho mục
              đích tuân thủ.
            </li>
          </ul>
          <p>
            Sau khi xoá, đăng nhập lại bằng cùng tài khoản Google sẽ tạo một tài khoản
            ZenStudy mới, trắng dữ liệu.
          </p>
        </Section>

        <Section id="thoi-han" title="5. Thời hạn xử lý">
          <p>
            Xoá trong ứng dụng hoặc trên trang này được thực hiện ngay khi bạn xác nhận.
            Nếu bạn không đăng nhập được và phải gửi yêu cầu qua email, chúng tôi xử lý
            trong vòng 30 ngày kể từ khi xác minh được chủ tài khoản.
          </p>
        </Section>

        <Section id="khong-dang-nhap-duoc" title="6. Không đăng nhập được?">
          <p>
            Gửi email tới{" "}
            <a
              className="text-emerald-300 hover:text-emerald-200 underline underline-offset-2"
              href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Xóa tài khoản ZenStudy")}`}
            >
              {CONTACT_EMAIL}
            </a>{" "}
            từ địa chỉ email bạn đã dùng để đăng nhập, tiêu đề &ldquo;Xóa tài khoản
            ZenStudy&rdquo;. Chúng tôi sẽ xoá tài khoản, dữ liệu đã đồng bộ trên
            Cloudflare D1 và lịch sử trò chuyện trên Firestore trong vòng 30 ngày.
          </p>
        </Section>
      </article>

      <footer className="mt-10 border-t border-white/10 pt-5 text-xs text-slate-500">
        <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-1.5">
          <span className="whitespace-nowrap">
            © {new Date().getFullYear()} ZenStudy Space
          </span>
          <span aria-hidden="true" className="hidden sm:inline">
            ·
          </span>
          <Link
            href="/privacy/"
            className="whitespace-nowrap text-slate-300 hover:text-white transition-colors"
          >
            Chính sách quyền riêng tư
          </Link>
          <span aria-hidden="true" className="hidden sm:inline">
            ·
          </span>
          <Link
            href="/"
            className="whitespace-nowrap text-slate-300 hover:text-white transition-colors"
          >
            Trang chủ
          </Link>
        </div>
      </footer>
    </main>
  );
}
