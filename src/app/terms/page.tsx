import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Điều khoản sử dụng",
  description:
    "Quy tắc sử dụng ZenStudy Space: độ tuổi, tài khoản, trợ lý AI, phòng học nhóm, nội dung của bạn, báo cáo vi phạm và giới hạn trách nhiệm.",
  alternates: { canonical: "/terms/" },
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

export default function TermsPage() {
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
          Điều khoản sử dụng
        </h1>
        <p className="text-sm text-slate-400">
          Áp dụng cho website{" "}
          <span className="text-slate-200 font-medium">zenstudy.space</span> và
          ứng dụng Android{" "}
          <span className="text-slate-200 font-medium">ZenStudy Space</span>.
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
          <li>Dùng ZenStudy nghĩa là bạn đồng ý với các quy tắc dưới đây.</li>
          <li>Dành cho người từ 13 tuổi; nếu bạn dưới 16 tuổi, cần sự đồng ý của cha mẹ hoặc người giám hộ.</li>
          <li>Tôn trọng người khác; không ghi âm, ghi hình khi chưa được đồng ý.</li>
          <li>AI có thể trả lời sai; không dùng thay tư vấn y tế, pháp lý hoặc tài chính.</li>
          <li>Ghi chú và tin nhắn vẫn là của bạn. Chúng tôi chỉ lưu, đồng bộ và hiển thị lại cho bạn — không bán, không quảng cáo, không dùng để huấn luyện AI.</li>
        </ul>
      </div>

      <article className="mt-8 space-y-8">
        <Section id="gioi-thieu" title="1. Giới thiệu và chấp nhận điều khoản">
          <p>
            ZenStudy Space (&ldquo;ZenStudy&rdquo;, &ldquo;chúng tôi&rdquo;) là không
            gian học tập trực tuyến do Lều Tiến Dũng phát triển, gồm website
            zenstudy.space và ứng dụng Android. Điều khoản này là thỏa thuận giữa
            bạn và ZenStudy về việc sử dụng dịch vụ.
          </p>
          <p>
            Khi dùng ZenStudy, bạn đồng ý với điều khoản này và{" "}
            <Link
              className="text-emerald-300 hover:text-emerald-200 underline underline-offset-2"
              href="/privacy/"
            >
              Chính sách quyền riêng tư
            </Link>
            . Nếu không đồng ý, bạn vui lòng ngừng sử dụng.
          </p>
        </Section>

        <Section id="do-tuoi-tai-khoan" title="2. Độ tuổi và tài khoản">
          <p>
            ZenStudy dành cho người từ 13 tuổi trở lên. Nếu bạn dưới 16 tuổi, hãy
            dùng với sự đồng ý của cha mẹ hoặc người giám hộ.
          </p>
          <ul className="list-disc pl-5 space-y-1 marker:text-slate-500">
            <li>
              Bạn đăng nhập bằng tài khoản Google thông qua Firebase. Bạn chịu
              trách nhiệm cho hoạt động diễn ra dưới tài khoản của mình.
            </li>
            <li>Không chia sẻ tài khoản cho người khác; báo cho chúng tôi nếu tài khoản bị truy cập trái phép.</li>
            <li>
              Một số tính năng dùng được không cần tài khoản; trợ lý AI cần đăng
              nhập Google.
            </li>
            <li>
              Chúng tôi có thể tạm khóa hoặc khóa tài khoản vi phạm điều khoản này
              hoặc quy định pháp luật.
            </li>
          </ul>
        </Section>

        <Section id="quy-tac-chung" title="3. Quy tắc sử dụng chung">
          <p>Khi dùng ZenStudy, bạn không được:</p>
          <ul className="list-disc pl-5 space-y-1 marker:text-slate-500">
            <li>
              Vi phạm pháp luật; quấy rối, đe dọa, xúc phạm, phân biệt đối xử, thù
              địch hoặc phát tán nội dung khiêu dâm, bạo lực, xâm hại trẻ em.
            </li>
            <li>Mạo danh người khác; gửi spam hoặc quảng cáo trái phép.</li>
            <li>
              Dịch ngược, phá hoại, can thiệp hệ thống, vượt giới hạn sử dụng, né
              cơ chế bảo mật hoặc thu thập dữ liệu tự động.
            </li>
            <li>Đăng tải mã độc hoặc nội dung bạn không có quyền sử dụng.</li>
            <li>Dùng dịch vụ để gây hại người khác hoặc làm quá tải hệ thống.</li>
          </ul>
        </Section>

        <Section id="tro-ly-ai" title="4. Trợ lý AI">
          <ul className="list-disc pl-5 space-y-1 marker:text-slate-500">
            <li>
              Trợ lý AI dùng mô hình của bên thứ ba. Câu trả lời có thể sai, thiếu
              ý, lỗi thời hoặc thiên lệch; bạn cần kiểm chứng lại với tài liệu
              chính thống.
            </li>
            <li>
              Không dùng câu trả lời của AI thay cho tư vấn y tế, pháp lý, tài chính
              hoặc quyết định quan trọng.
            </li>
            <li>
              Không gửi thông tin nhạy cảm như giấy tờ tùy thân, tài khoản ngân
              hàng, dữ liệu sức khỏe, bí mật kinh doanh hay dữ liệu của người khác
              khi chưa được phép.
            </li>
            <li>
              Số lượt hỏi mỗi ngày có giới hạn. Chúng tôi có thể đổi nhà cung cấp
              hoặc mô hình AI, hoặc tạm ngừng tính năng để bảo trì.
            </li>
            <li>
              Chúng tôi có thể lọc hoặc từ chối nội dung không phù hợp. Nếu thấy câu
              trả lời xấu, hãy báo cáo qua email bên dưới hoặc công cụ báo cáo
              trong ứng dụng khi có.
            </li>
            <li>
              Lịch sử trò chuyện được lưu như mô tả trong Chính sách quyền riêng tư;
              bạn có thể xóa từng đoạn chat bất cứ lúc nào.
            </li>
          </ul>
        </Section>

        <Section id="phong-hoc" title="5. Phòng học nhóm">
          <ul className="list-disc pl-5 space-y-1 marker:text-slate-500">
            <li>
              Phòng học truyền âm thanh và video trực tiếp qua LiveKit. ZenStudy
              không ghi âm, không ghi hình cuộc gọi.
            </li>
            <li>
              Khi bạn bật mic hoặc camera, người trong phòng có thể nghe và thấy bạn.
            </li>
            <li>
              Không ghi âm, ghi hình, chụp màn hình người khác khi chưa có sự đồng
              ý; không phát tán nội dung của người khác.
            </li>
            <li>
              Tôn trọng người cùng phòng. Người tạo phòng có quyền mute, mời ra khỏi
              phòng, khóa phòng hoặc đặt mật khẩu; bạn cần tuân thủ.
            </li>
            <li>
              Nếu bị quấy rối, hãy báo cáo qua email hoặc công cụ báo cáo trong ứng
              dụng khi có. Chúng tôi có thể kết thúc phòng, hạn chế hoặc khóa tài
              khoản vi phạm.
            </li>
            <li>Phòng học không dùng cho cấp cứu hoặc tình huống khẩn cấp.</li>
          </ul>
        </Section>

        <Section id="noi-dung-cua-ban" title="6. Nội dung của bạn và quyền sở hữu">
          <p>
            Bạn giữ quyền đối với ghi chú, việc cần làm, tin nhắn và tệp bạn tạo
            hoặc tải lên. Bạn cho ZenStudy quyền giới hạn, không độc quyền và không
            phải trả tiền để:
          </p>
          <ul className="list-disc pl-5 space-y-1 marker:text-slate-500">
            <li>lưu và đồng bộ nội dung giữa các thiết bị của bạn;</li>
            <li>hiển thị lại nội dung cho chính bạn;</li>
            <li>gửi câu hỏi, ảnh hoặc tệp tới nhà cung cấp AI khi bạn dùng trợ lý AI.</li>
          </ul>
          <p>
            Chúng tôi không bán, không dùng nội dung của bạn cho quảng cáo và không
            dùng nội dung của bạn để huấn luyện mô hình AI.
          </p>
          <p>
            Bạn chịu trách nhiệm về tính hợp pháp của nội dung mình đăng tải. Tên,
            logo, giao diện, cảnh nền, âm thanh và nhạc của ZenStudy thuộc chúng tôi
            hoặc bên cấp phép; bạn không được sao chép hoặc phân phối lại.
          </p>
          <p>
            Video và nhạc nhúng từ YouTube, Spotify hoặc dịch vụ khác do bên thứ ba
            cung cấp và tuân theo điều khoản của họ. ZenStudy không kiểm soát nội
            dung đó.
          </p>
        </Section>

        <Section id="bao-cao" title="7. Báo cáo và xử lý vi phạm">
          <p>
            Khi báo cáo nội dung hoặc hành vi vi phạm, bạn gửi tới{" "}
            <a
              className="text-emerald-300 hover:text-emerald-200 underline underline-offset-2"
              href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Báo cáo vi phạm ZenStudy")}`}
            >
              {CONTACT_EMAIL}
            </a>{" "}
            kèm mô tả, thời gian và người liên quan (nếu biết). Chúng tôi cố gắng
            xem xét trong vòng 7 ngày.
          </p>
          <p>
            Tùy mức độ, chúng tôi có thể xóa nội dung, hạn chế hoặc khóa tài khoản.
            Thông tin báo cáo được lưu để xử lý và có thể được giữ lại sau khi tài
            khoản bị xóa nếu pháp luật yêu cầu. Báo cáo sai hoặc ác ý có thể bị xử
            lý như hành vi vi phạm.
          </p>
        </Section>

        <Section id="dich-vu" title="8. Dịch vụ miễn phí, thay đổi và gián đoạn">
          <p>
            ZenStudy hiện miễn phí. Chúng tôi có thể thêm, bớt hoặc thay đổi tính
            năng và giới hạn sử dụng. Dịch vụ có thể gián đoạn do bảo trì, sự cố
            mạng hoặc lỗi từ bên thứ ba.
          </p>
          <p>
            Chúng tôi không bảo đảm dịch vụ luôn sẵn sàng, không lỗi hoặc không mất
            dữ liệu. Ứng dụng có thể tự cập nhật từ xa; điều khoản này áp dụng cho
            cả các bản cập nhật.
          </p>
        </Section>

        <Section id="trach-nhiem" title="9. Giới hạn trách nhiệm">
          <p>
            Trong phạm vi pháp luật cho phép, ZenStudy không chịu trách nhiệm cho
            thiệt hại gián tiếp, mất dữ liệu ngoài khả năng khôi phục hợp lý, nội
            dung do người dùng đăng tải, câu trả lời của AI hoặc sự cố từ dịch vụ
            bên thứ ba.
          </p>
          <p>
            Điều này không giới hạn các quyền mà pháp luật dành cho bạn với tư cách
            người tiêu dùng.
          </p>
        </Section>

        <Section id="cham-dut" title="10. Chấm dứt">
          <p>
            Bạn có thể ngừng sử dụng bất cứ lúc nào và xóa tài khoản tại{" "}
            <Link
              className="text-emerald-300 hover:text-emerald-200 underline underline-offset-2"
              href="/account-deletion/"
            >
              trang xoá tài khoản
            </Link>
            . Chúng tôi có thể tạm ngưng hoặc khóa tài khoản nếu bạn vi phạm điều
            khoản này hoặc khi pháp luật yêu cầu.
          </p>
          <p>
            Các điều về quyền sở hữu trí tuệ, giới hạn trách nhiệm và luật áp dụng
            vẫn có hiệu lực sau khi chấm dứt.
          </p>
        </Section>

        <Section id="thay-doi" title="11. Thay đổi điều khoản">
          <p>
            Điều khoản có thể được cập nhật khi ZenStudy thay đổi tính năng hoặc quy
            định. Bản mới luôn nằm trên trang này kèm ngày cập nhật. Thay đổi quan
            trọng sẽ được thông báo trong ứng dụng hoặc trên website. Việc tiếp tục
            sử dụng sau khi cập nhật nghĩa là bạn chấp nhận điều khoản mới.
          </p>
        </Section>

        <Section id="lien-he" title="12. Luật áp dụng và liên hệ">
          <p>
            Điều khoản này được điều chỉnh bởi pháp luật Việt Nam. Mọi câu hỏi, gửi
            tới{" "}
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
