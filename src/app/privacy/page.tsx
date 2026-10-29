import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Chính sách quyền riêng tư",
  description:
    "ZenStudy Space dùng những thông tin gì khi bạn dùng web và ứng dụng Android: lưu trên máy, đồng bộ khi đăng nhập Google, trợ lý AI và phòng học nhóm.",
  alternates: { canonical: "/privacy/" },
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

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-8 sm:py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
      >
        <span aria-hidden="true">←</span>
        Về ZenStudy Space
      </Link>

      <header className="mt-5 space-y-3">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white text-balance">
          Chính sách quyền riêng tư
        </h1>
        <p className="text-sm text-slate-400">
          Áp dụng cho website{" "}
          <span className="text-slate-200 font-medium">zenstudy.space</span> và
          ứng dụng Android <span className="text-slate-200 font-medium">ZenStudy Space</span>.
        </p>
        <p className="text-xs text-slate-500 font-mono">
          Ngày hiệu lực: {UPDATED_AT} · Cập nhật lần cuối: {UPDATED_AT}
        </p>
      </header>

      <div className="mt-6 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">
          Tóm tắt nhanh
        </p>
        <ul className="mt-2 space-y-1.5 text-sm text-slate-200 list-disc pl-5 marker:text-emerald-300">
          <li>Mặc định mọi thứ lưu trên máy bạn; dùng được mà không cần tài khoản.</li>
          <li>Đăng nhập Google là tùy chọn, chỉ dùng để đồng bộ và gọi trợ lý AI.</li>
          <li>Lịch sử trò chuyện AI được lưu trong tài khoản để xem lại trên các thiết bị.</li>
          <li>Không bán dữ liệu, không quảng cáo, không dùng công cụ theo dõi của bên thứ ba.</li>
          <li>Phòng học nhóm không ghi âm, không ghi hình.</li>
        </ul>
      </div>

      <article className="mt-8 space-y-8">
        <Section id="gioi-thieu" title="1. Giới thiệu">
          <p>
            ZenStudy Space (gọi tắt là &ldquo;ZenStudy&rdquo;, &ldquo;chúng tôi&rdquo;) là
            không gian học tập trực tuyến do Lều Tiến Dũng phát triển. Trang này
            giải thích ZenStudy dùng những thông tin gì khi bạn dùng website và ứng
            dụng Android, và bạn kiểm soát những thông tin đó ra sao.
          </p>
          <p>
            Khi dùng ZenStudy, bạn đồng ý với cách chúng tôi dùng thông tin như mô
            tả dưới đây.
          </p>
        </Section>

        <Section id="du-lieu-tren-thiet-bi" title="2. Thông tin lưu trên máy bạn">
          <p>
            ZenStudy ưu tiên lưu trên máy bạn. Khi chưa đăng nhập, dữ liệu nằm
            trong bộ nhớ của trình duyệt hoặc trong ứng dụng trên điện thoại, gồm:
          </p>
          <ul className="list-disc pl-5 space-y-1 marker:text-slate-500">
            <li>Cài đặt giao diện: cảnh nền, âm thanh, âm lượng, chế độ sáng/tối.</li>
            <li>Ghi chú, danh sách việc cần làm, liên kết nhúng (YouTube, Spotify).</li>
            <li>Thống kê phiên tập trung, trạng thái Pomodoro và hướng dẫn lần đầu.</li>
            <li>Ảnh gốc bạn đính kèm khi trò chuyện với trợ lý AI.</li>
          </ul>
          <p>Nếu bạn không đăng nhập, những dữ liệu này không rời khỏi máy bạn.</p>
        </Section>

        <Section id="tai-khoan" title="3. Tài khoản và đăng nhập Google">
          <p>
            ZenStudy dùng Firebase Authentication (dịch vụ đăng nhập của Google) và
            nút đăng nhập chính thức của Google. Khi bạn đăng nhập, chúng tôi nhận:
          </p>
          <ul className="list-disc pl-5 space-y-1 marker:text-slate-500">
            <li>Mã số tài khoản (UID).</li>
            <li>Email, tên hiển thị và ảnh đại diện (nếu có).</li>
          </ul>
          <p>
            Chúng tôi dùng những thông tin này để biết bạn là ai, đồng bộ dữ liệu
            giữa các thiết bị và giới hạn số lượt dùng trợ lý AI. ZenStudy không
            nhận và không lưu mật khẩu Google của bạn.
          </p>
          <p className="text-xs text-slate-400">
            Tìm hiểu thêm:{" "}
            <a
              className="text-emerald-300 hover:text-emerald-200 underline underline-offset-2"
              href="https://firebase.google.com/support/privacy"
              target="_blank"
              rel="noreferrer"
            >
              Chính sách quyền riêng tư của Firebase
            </a>{" "}
            và{" "}
            <a
              className="text-emerald-300 hover:text-emerald-200 underline underline-offset-2"
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noreferrer"
            >
              của Google
            </a>
            .
          </p>
        </Section>

        <Section id="dong-bo" title="4. Đồng bộ khi đăng nhập">
          <p>
            Khi bạn đăng nhập, ZenStudy gộp dữ liệu không gian học thành một bản
            sao lưu và lưu trên máy chủ Cloudflare (dịch vụ D1), gắn với tài khoản
            của bạn. Bản sao lưu gồm: cài đặt không gian học, ghi chú, việc cần
            làm, cảnh yêu thích, liên kết nhúng và thống kê phiên tập trung.
          </p>
          <p>
            Đăng xuất sẽ xóa dữ liệu trên máy; bản sao lưu vẫn được giữ để khôi
            phục khi bạn đăng nhập lại. Cách xóa bản sao lưu được mô tả ở mục 9.
          </p>
          <p>
            Lịch sử trò chuyện với trợ lý AI được lưu riêng trên Firestore (cơ sở
            dữ liệu của Google), không nằm trong bản sao lưu này. Xem mục 5.
          </p>
        </Section>

        <Section id="tro-ly-ai" title="5. Trợ lý AI và lịch sử trò chuyện">
          <p>
            Khi bạn gửi câu hỏi, ảnh hoặc tệp cho trợ lý AI, nội dung được gửi qua
            máy chủ của ZenStudy (Cloudflare Worker) đến dịch vụ AI mà ZenStudy
            đang dùng (Cloudflare Workers AI hoặc dịch vụ tương thích OpenAI/Gemini)
            để tạo câu trả lời.
          </p>
          <p>
            Để bạn xem lại hội thoại trên các thiết bị, ZenStudy lưu lịch sử trò
            chuyện vào Firestore, gắn với tài khoản Google của bạn:
          </p>
          <ul className="list-disc pl-5 space-y-1 marker:text-slate-500">
            <li>Tên đoạn chat (lấy từ câu hỏi đầu tiên) và thời điểm tạo/cập nhật.</li>
            <li>Tin nhắn của bạn và câu trả lời của AI (tối đa 8.000 ký tự mỗi tin).</li>
            <li>
              Với tệp đính kèm: tên tệp và ảnh thu nhỏ. Ảnh gốc chỉ nằm trên máy
              bạn, không được tải lên.
            </li>
            <li>200 ký tự đầu của câu trả lời gần nhất, dùng làm đoạn xem trước.</li>
          </ul>
          <p>
            Chỉ bạn mới đọc và sửa được dữ liệu này. ZenStudy không dùng nội dung
            hội thoại vào việc khác và không công khai nó. Lịch sử được giữ cho đến
            khi bạn xóa đoạn chat, xóa tài khoản hoặc yêu cầu xóa. Bạn có thể xóa
            từng đoạn chat trong ứng dụng — xóa đoạn chat sẽ xóa luôn các tin nhắn
            bên trong. Xem mục 9 để xóa toàn bộ.
          </p>
          <ul className="list-disc pl-5 space-y-1 marker:text-slate-500">
            <li>Chúng tôi đếm số lượt hỏi mỗi ngày theo tài khoản để giới hạn sử dụng.</li>
            <li>
              Dịch vụ AI có thể xử lý nội dung theo chính sách riêng của họ, nên
              bạn tránh gửi thông tin nhạy cảm.
            </li>
          </ul>
          <p>Nếu bạn không dùng tính năng này, không nội dung nào được gửi đi.</p>
        </Section>

        <Section id="phong-hoc" title="6. Phòng học nhóm (LiveKit)">
          <p>
            Phòng học nhóm dùng LiveKit để truyền âm thanh và video trực tiếp giữa
            những người tham gia. ZenStudy không ghi âm, không ghi hình và không
            lưu nội dung cuộc gọi.
          </p>
          <p>
            Để phòng hoạt động và giới hạn sử dụng, hệ thống lưu một số thông tin
            kỹ thuật: tên phòng, tên hiển thị, thời điểm vào/ra và thời lượng phiên.
            Mật khẩu phòng (nếu bạn đặt) được lưu ở dạng mã hóa một chiều, không
            đọc lại được.
          </p>
          <p>
            Lưu ý: khi bạn bật mic hoặc camera, những người trong phòng có thể nghe
            và thấy bạn.
          </p>
        </Section>

        <Section id="ha-tang" title="7. Máy chủ và nhật ký kỹ thuật">
          <p>
            ZenStudy chạy trên Cloudflare (Pages, Workers, D1, R2), dùng thêm
            Firebase (Google), LiveKit và dịch vụ AI. Những dịch vụ này có thể ghi
            lại địa chỉ IP, loại thiết bị/trình duyệt và lỗi phát sinh để bảo mật và
            giữ hệ thống chạy ổn.
          </p>
          <p>
            Nhật ký lỗi kỹ thuật của ZenStudy được xóa sau khoảng 14 ngày. Dữ liệu
            có thể được xử lý ngoài Việt Nam theo hệ thống máy chủ của các nhà cung
            cấp trên.
          </p>
          <p>
            ZenStudy không dùng cookie quảng cáo và không dùng công cụ phân tích
            theo dõi của bên thứ ba. Một số dịch vụ đăng nhập có thể dùng cookie
            hoặc bộ nhớ cục bộ để giữ phiên đăng nhập.
          </p>
        </Section>

        <Section id="chia-se" title="8. Chia sẻ dữ liệu">
          <p>Chúng tôi không bán dữ liệu của bạn.</p>
          <p>
            Dữ liệu chỉ được chia sẻ với các nhà cung cấp máy chủ nêu ở mục 7, ở
            mức cần thiết để chạy tính năng (đăng nhập, đồng bộ, phòng học, trợ lý
            AI) hoặc khi pháp luật yêu cầu.
          </p>
        </Section>

        <Section id="xoa-du-lieu" title="9. Lưu, xóa dữ liệu và quyền của bạn">
          <p className="font-semibold text-slate-200">Xóa dữ liệu trên máy</p>
          <p>
            Đăng xuất để xóa dữ liệu trên máy (với tài khoản khách, đăng xuất sẽ
            xóa toàn bộ dữ liệu). Bạn cũng có thể xóa dữ liệu trang trong trình
            duyệt hoặc gỡ ứng dụng.
          </p>
          <p className="font-semibold text-slate-200">Xóa lịch sử trò chuyện</p>
          <p>
            Trong ứng dụng, xóa từng đoạn chat ở danh sách hội thoại — tin nhắn và
            ảnh thu nhỏ bên trong đoạn chat đó cũng bị xóa.
          </p>
          <p className="font-semibold text-slate-200">Xóa tài khoản và dữ liệu đồng bộ</p>
          <p>
            Trong ứng dụng, mở hồ sơ tài khoản (ảnh đại diện ở thanh trên cùng; trên
            điện thoại vào tab &ldquo;Thêm&rdquo; → &ldquo;Tài khoản&rdquo;) rồi chọn
            &ldquo;Xoá tài khoản&rdquo;. Bạn cũng có thể xoá ngay trên web tại{" "}
            <Link
              className="text-emerald-300 hover:text-emerald-200 underline underline-offset-2"
              href="/account-deletion/"
            >
              trang xoá tài khoản
            </Link>
            . Dữ liệu đồng bộ trên Cloudflare D1, lịch sử trò chuyện trên Firestore và
            tài khoản đăng nhập được xoá ngay khi bạn xác nhận. Thao tác này không thể
            khôi phục.
          </p>
          <p>
            Nếu không đăng nhập được, gửi email tới{" "}
            <a
              className="text-emerald-300 hover:text-emerald-200 underline underline-offset-2"
              href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Xóa tài khoản ZenStudy")}`}
            >
              {CONTACT_EMAIL}
            </a>{" "}
            từ địa chỉ email bạn đã dùng để đăng nhập, tiêu đề &ldquo;Xóa tài khoản
            ZenStudy&rdquo;. Chúng tôi sẽ xóa tài khoản, dữ liệu đồng bộ trên
            Cloudflare D1 và lịch sử trò chuyện trên Firestore trong vòng 30 ngày.
          </p>
          <p className="font-semibold text-slate-200">Quyền của bạn</p>
          <p>
            Bạn có quyền xem, sửa, xóa dữ liệu, phản đối việc xử lý và rút lại sự
            đồng ý (bằng cách ngừng dùng hoặc đăng xuất). Gửi yêu cầu tới email ở
            trên nếu cần hỗ trợ.
          </p>
        </Section>

        <Section id="tre-em" title="10. Trẻ em">
          <p>
            ZenStudy dành cho người từ 13 tuổi trở lên. Chúng tôi không cố ý thu
            thập dữ liệu của trẻ dưới 13 tuổi; nếu phát hiện, chúng tôi sẽ xóa.
          </p>
        </Section>

        <Section id="thay-doi" title="11. Thay đổi chính sách">
          <p>
            Chính sách có thể được cập nhật khi ZenStudy thêm tính năng hoặc đổi máy
            chủ. Bản mới luôn nằm trên trang này kèm ngày cập nhật. Thay đổi quan
            trọng sẽ được thông báo trong ứng dụng hoặc trên website.
          </p>
        </Section>

        <Section id="lien-he" title="12. Liên hệ">
          <p>
            Mọi câu hỏi về quyền riêng tư, gửi tới:{" "}
            <a
              className="text-emerald-300 hover:text-emerald-200 underline underline-offset-2"
              href={`mailto:${CONTACT_EMAIL}`}
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>
      </article>

      <footer className="mt-10 border-t border-white/10 pt-5 text-xs text-slate-500">
        <p>
          © {new Date().getFullYear()} ZenStudy Space ·{" "}
          <Link href="/" className="text-slate-300 hover:text-white transition-colors">
            Trang chủ
          </Link>
        </p>
      </footer>
    </main>
  );
}
