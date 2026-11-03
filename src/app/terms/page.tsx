import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Điều khoản sử dụng",
  description:
    "Quy tắc sử dụng ZenStudy Space: độ tuổi, tài khoản, trợ lý AI, phòng học nhóm, nội dung của bạn, báo cáo vi phạm và giới hạn trách nhiệm.",
  alternates: { canonical: "/terms/" },
  robots: { index: true, follow: true },
};

const UPDATED_AT = "03/11/2026";
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
          Tóm tắt nhanh cho bạn
        </p>
        <ul className="mt-2 space-y-1.5 text-sm text-slate-200 list-disc pl-5 marker:text-emerald-300">
          <li>Khi trải nghiệm ZenStudy, bạn đồng ý với các quy tắc đơn giản và rõ ràng dưới đây.</li>
          <li>Dành cho người học từ đủ 16 tuổi trở lên; người 16–17 tuổi vẫn là người chưa thành niên nên vẫn được áp dụng giới hạn nội dung vì an toàn.</li>
          <li>Tôn trọng mọi người xung quanh: tuyệt đối không tự ý ghi âm, quay video hay chụp ảnh người khác khi chưa được cho phép.</li>
          <li>Trợ lý AI đôi lúc có thể trả lời chưa chính xác; câu trả lời chỉ mang tính tham khảo học tập, không dùng thay lời khuyên y tế, pháp lý hay tài chính.</li>
          <li>Ghi chú, danh sách việc cần làm và tin nhắn luôn thuộc sở hữu của bạn: ZenStudy không bán, không gắn quảng cáo và không dùng để huấn luyện AI.</li>
          <li>Bạn có thể chủ động báo cáo nội dung không phù hợp và chặn người làm phiền ngay trong ứng dụng; báo cáo sẽ được xem xét và xử lý trong khoảng 7 ngày.</li>
        </ul>
      </div>

      <article className="mt-8 space-y-8">
        <Section id="gioi-thieu" title="1. Giới thiệu và sự đồng thuận của bạn">
          <p>
            ZenStudy Space (&ldquo;ZenStudy&rdquo;, &ldquo;chúng tôi&rdquo;) là không
            gian học tập trực tuyến do tác giả Lều Tiến Dũng phát triển, bao gồm website
            zenstudy.space và ứng dụng di động Android. Điều khoản này là thỏa thuận chung
            giữa bạn và ZenStudy về quyền lợi cùng trách nhiệm khi sử dụng dịch vụ.
          </p>
          <p>
            Khi truy cập hoặc sử dụng ZenStudy, bạn xác nhận đã đọc, hiểu và đồng ý với điều khoản này cùng{" "}
            <Link
              className="text-emerald-300 hover:text-emerald-200 underline underline-offset-2"
              href="/privacy/"
            >
              Chính sách quyền riêng tư
            </Link>
            . Nếu không đồng ý với bất kỳ quy định nào, bạn có thể ngừng sử dụng dịch vụ bất cứ lúc nào.
          </p>
        </Section>

        <Section id="do-tuoi-tai-khoan" title="2. Độ tuổi phù hợp và quản lý tài khoản">
          <p>
            ZenStudy được xây dựng dành cho người học từ đủ 16 tuổi trở lên. Người dùng từ 16 đến dưới 18 tuổi vẫn là người chưa thành niên, nên một số nội dung có thể bị giới hạn vì mục đích an toàn, nhưng không cần thêm sự đồng ý của cha mẹ hay người giám hộ. Nếu bạn dưới 16 tuổi, vui lòng không sử dụng ZenStudy; hãy quay lại khi đủ tuổi hoặc nhờ phụ huynh tìm công cụ học tập phù hợp hơn.
          </p>
          <ul className="list-disc pl-5 space-y-1 marker:text-slate-500">
            <li>
              Bạn có thể sử dụng hầu hết các công cụ học tập ngay mà không cần tạo tài khoản.
            </li>
            <li>
              Để đồng bộ dữ liệu giữa các thiết bị và trò chuyện với trợ lý AI, bạn đăng nhập bằng tài khoản Google thông qua giao thức an toàn chính thức của Google.
            </li>
            <li>
              Bạn có trách nhiệm bảo quản thiết bị cá nhân và các hoạt động diễn ra từ tài khoản của mình. Vui lòng không chia sẻ tài khoản cho người khác và báo ngay cho chúng tôi nếu nghi ngờ có truy cập bất thường.
            </li>
            <li>
              Chúng tôi có thể tạm ngừng hoặc khóa vĩnh viễn những tài khoản cố tình vi phạm các quy tắc này hoặc vi phạm quy định pháp luật.
            </li>
          </ul>
        </Section>

        <Section id="quy-tac-chung" title="3. Quy tắc ứng xử và sử dụng văn minh">
          <p>ZenStudy là không gian học tập tích cực và yên tĩnh. Khi tham gia, bạn vui lòng không thực hiện các hành vi sau:</p>
          <ul className="list-disc pl-5 space-y-1 marker:text-slate-500">
            <li>
              Vi phạm pháp luật; quấy rối, đe dọa, xúc phạm danh dự, phân biệt đối xử, thù địch hoặc chia sẻ các nội dung khiêu dâm, bạo lực, xâm hại trẻ em.
            </li>
            <li>Mạo danh người khác; gửi thư rác (spam) hoặc tin nhắn quảng cáo trái phép.</li>
            <li>
              Cố tình phá hoại, can thiệp vào máy chủ, né tránh các cơ chế bảo mật hoặc sử dụng phần mềm tự động (bot, script cào dữ liệu) làm ảnh hưởng đến trải nghiệm của người khác.
            </li>
            <li>Tải lên tệp chứa mã độc, virus hoặc các nội dung bạn không có bản quyền sử dụng.</li>
            <li>Sử dụng dịch vụ để gây phiền toái cho người khác hoặc làm quá tải hệ thống học tập chung.</li>
          </ul>
        </Section>

        <Section id="tro-ly-ai" title="4. Trợ lý AI và nguyên tắc an toàn">
          <ul className="list-disc pl-5 space-y-1 marker:text-slate-500">
            <li>
              Trợ lý AI vận hành dựa trên công nghệ trí tuệ nhân tạo hiện đại. Dù vậy, câu trả lời của AI đôi lúc có thể chưa chính xác, thiếu sót hoặc chưa cập nhật; bạn nên chủ động kiểm chứng lại với sách giáo khoa, bài giảng hoặc tài liệu chính thống.
            </li>
            <li>
              Câu trả lời của AI chỉ dùng để tham khảo trong học tập; tuyệt đối không dùng thay thế cho sự tư vấn chuyên môn từ bác sĩ y khoa, luật sư, chuyên gia tài chính hoặc các quyết định quan trọng ảnh hưởng đến tính mạng, sức khỏe.
            </li>
            <li>
              Để bảo vệ sự an toàn của chính mình, vui lòng không gửi cho AI các thông tin bí mật cá nhân như căn cước công dân, tài khoản ngân hàng, thông tin bệnh án hay dữ liệu của người khác khi chưa được họ đồng ý.
            </li>
            <li>
              Số lượt hỏi bài mỗi ngày được giới hạn hợp lý theo tài khoản để bảo đảm dịch vụ hoạt động công bằng cho tất cả mọi người. Chúng tôi có thể nâng cấp mô hình AI hoặc tạm dừng tính năng trong thời gian ngắn để bảo trì.
            </li>
            <li>
              Hệ thống có bộ lọc an toàn tự động: các yêu cầu có dấu hiệu gây hại (như tự hại, bạo lực, chất cấm, nội dung người lớn, thu thập thông tin người khác) sẽ bị từ chối và nhận phản hồi hướng dẫn an toàn thay vì gửi đến dịch vụ AI.
            </li>
            <li>
              Nếu phát hiện câu trả lời chưa chuẩn xác hay phản cảm, bạn hãy bấm vào biểu tượng lá cờ ngay bên dưới câu trả lời đó để báo cáo cho chúng tôi xem xét.
            </li>
            <li>
              Lịch sử trò chuyện được lưu riêng cho tài khoản của bạn như được giải thích trong Chính sách quyền riêng tư; bạn có thể tự do xóa từng đoạn chat bất kỳ lúc nào.
            </li>
          </ul>
        </Section>

        <Section id="phong-hoc" title="5. Phòng học nhóm (Study Room)">
          <ul className="list-disc pl-5 space-y-1 marker:text-slate-500">
            <li>
              Phòng học truyền âm thanh và hình ảnh trực tiếp giữa các thành viên đang có mặt. ZenStudy tuyệt đối không ghi âm, không ghi hình và không lưu lại bất kỳ nội dung nào của cuộc gọi.
            </li>
            <li>
              Khi bạn bật micrô hoặc máy ảnh, các bạn học khác trong phòng sẽ nghe và nhìn thấy bạn. Hãy chú ý trang phục và giữ không gian học tập yên tĩnh, văn minh.
            </li>
            <li>
              Tôn trọng tuyệt đối hình ảnh cá nhân của bạn học: Nghiêm cấm hành vi tự ý ghi âm, quay màn hình, chụp ảnh các thành viên trong phòng hoặc phát tán hình ảnh/giọng nói của người khác khi chưa được họ đồng ý rõ ràng.
            </li>
            <li>
              Người tạo phòng (chủ phòng) có các quyền điều phối như: tắt mic thành viên ồn ào, mời người gây rối ra khỏi phòng, khóa phòng không nhận thêm người hoặc đặt mật khẩu phòng. Các thành viên trong phòng vui lòng tôn trọng sự điều phối chung này.
            </li>
            <li>
              Chủ động tự bảo vệ bằng tính năng chặn: Nếu cảm thấy bị làm phiền, bạn có thể bấm trực tiếp vào thẻ của bạn học đó để chọn &ldquo;Chặn&rdquo;. Việc chặn có hiệu lực hai chiều (hai bạn sẽ không bao giờ vào chung phòng với nhau được nữa), bạn sẽ tự động rời khỏi phòng hiện tại và có thể quản lý danh sách chặn trong Cài đặt bất cứ lúc nào.
            </li>
            <li>
              Nếu bị quấy rối hoặc nhận thấy hành vi xấu, hãy dùng nút báo cáo ngay trên thẻ thành viên đó hoặc gửi email cho chúng tôi. Chúng tôi sẽ can thiệp để bảo vệ bạn.
            </li>
            <li>Phòng học nhóm chỉ dành cho việc tự học; không sử dụng cho các cuộc gọi cấp cứu hoặc tình huống khẩn cấp.</li>
          </ul>
        </Section>

        <Section id="noi-dung-cua-ban" title="6. Quyền sở hữu nội dung và tài sản trí tuệ">
          <p>
            Bạn luôn là chủ sở hữu duy nhất của các ghi chú, danh sách việc cần làm (to-do list), tin nhắn và tệp bạn tạo ra hoặc tải lên ứng dụng. Bạn chỉ cấp cho ZenStudy quyền sử dụng tối thiểu và miễn phí để:
          </p>
          <ul className="list-disc pl-5 space-y-1 marker:text-slate-500">
            <li>lưu trữ và đồng bộ nội dung giữa các thiết bị cá nhân của bạn;</li>
            <li>hiển thị lại nội dung đầy đủ cho chính bạn;</li>
            <li>chuyển tiếp câu hỏi, hình ảnh hoặc tệp sang dịch vụ AI đối tác khi bạn chọn hỏi bài trợ lý AI.</li>
          </ul>
          <p>
            ZenStudy cam kết: Chúng tôi không bán nội dung của bạn, không dùng cho quảng cáo và không sử dụng bất kỳ ghi chú hay tin nhắn nào của bạn để huấn luyện các mô hình AI.
          </p>
          <p>
            Bạn chịu trách nhiệm về tính hợp pháp của nội dung bạn đưa lên. Ngược lại, tên thương hiệu, biểu tượng (logo), giao diện thiết kế, các cảnh nền học tập, âm thanh môi trường và bản nhạc tích hợp sẵn trong ứng dụng thuộc sở hữu của ZenStudy hoặc các tác giả cấp phép; bạn vui lòng không sao chép, trích xuất hay kinh doanh lại.
          </p>
          <p>
            Các video và danh sách bài hát nhúng từ YouTube, Spotify hoặc dịch vụ bên thứ ba do các nền tảng đó cung cấp, tuân theo điều khoản sử dụng của họ. ZenStudy không kiểm soát hay sở hữu các nội dung này.
          </p>
        </Section>

        <Section id="bao-cao" title="7. Báo cáo vi phạm, chặn người dùng và quy trình xử lý">
          <p>
            ZenStudy cung cấp các công cụ trực quan ngay trên màn hình để bạn chủ động phản ánh vi phạm:
          </p>
          <ul className="list-disc pl-5 space-y-1 marker:text-slate-500">
            <li>
              Báo cáo câu trả lời của trợ lý AI: Bấm vào biểu tượng lá cờ ngay bên dưới câu trả lời không phù hợp.
            </li>
            <li>
              Báo cáo hoặc chặn thành viên trong phòng học: Bấm vào biểu tượng dấu ba chấm (&ldquo;⋮&rdquo;) trên thẻ của người đó.
            </li>
          </ul>
          <p>
            Bạn cũng có thể gửi thư phản ánh trực tiếp tới{" "}
            <a
              className="text-emerald-300 hover:text-emerald-200 underline underline-offset-2"
              href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Báo cáo vi phạm ZenStudy")}`}
            >
              {CONTACT_EMAIL}
            </a>{" "}
            kèm theo mô tả sự việc, thời gian xảy ra và tài khoản liên quan. Đội ngũ quản trị sẽ xem xét và phản hồi trong vòng tối đa 7 ngày làm việc.
          </p>
          <p>
            Dữ liệu báo cáo được lưu trữ tối đa khoảng 180 ngày để phục vụ việc đối chiếu xử lý, sau đó hệ thống sẽ tự động xóa sạch; các thông tin lưu gồm nội dung bị phản ánh, lý do, ghi chú của bạn và tên hiển thị như được mô tả trong Chính sách quyền riêng tư.
          </p>
          <p>
            Tùy theo mức độ vi phạm, chúng tôi có thể đưa ra lời nhắc nhở, xóa nội dung vi phạm, tạm khóa tính năng AI / phòng học, hoặc khóa tài khoản vĩnh viễn đối với hành vi nghiêm trọng. Chúng tôi nghiêm cấm việc cố ý gửi báo cáo sai sự thật hoặc vu khống người khác.
          </p>
          <p>
            Việc chặn người dùng có hiệu lực từ hai phía (hai bạn sẽ không còn chung phòng được nữa) và bạn có thể gỡ bỏ bất kỳ lúc nào trong phần Cài đặt. Khi bạn chọn xóa tài khoản, tất cả dữ liệu báo cáo và danh sách chặn liên quan của bạn cũng sẽ được xóa sạch hoàn toàn.
          </p>
        </Section>

        <Section id="dich-vu" title="8. Dịch vụ miễn phí, nâng cấp và sự gián đoạn">
          <p>
            ZenStudy hiện được cung cấp hoàn toàn miễn phí cho cộng đồng người học. Chúng tôi luôn nỗ lực phát triển thêm các tính năng hữu ích để nâng cao trải nghiệm học tập của bạn.
          </p>
          <p>
            Trong quá trình vận hành, dịch vụ có thể được điều chỉnh, nâng cấp hoặc tạm ngưng ngắn hạn để bảo trì hệ thống. Đôi khi dịch vụ có thể bị gián đoạn do sự cố đường truyền mạng internet hoặc lỗi kỹ thuật từ các nhà cung cấp hạ tầng đám mây ngoài ý muốn.
          </p>
          <p>
            Ứng dụng di động có thể nhận các bản cập nhật từ xa; bản Điều khoản sử dụng này tự động áp dụng cho tất cả các bản cập nhật đó.
          </p>
        </Section>

        <Section id="trach-nhiem" title="9. Giới hạn trách nhiệm">
          <p>
            Chúng tôi xây dựng ZenStudy với sự cẩn trọng và tận tâm lớn nhất để hỗ trợ việc học của bạn. Tuy nhiên, dịch vụ được cung cấp trên tinh thần &ldquo;như hiện có&rdquo; (as-is).
          </p>
          <p>
            Trong phạm vi tối đa mà pháp luật cho phép, ZenStudy không chịu trách nhiệm pháp lý đối với những thiệt hại mang tính gián tiếp phát sinh (chẳng hạn như: việc học tập bị gián đoạn do mất kết nối mạng bất ngờ, mất mát dữ liệu do thiết bị cá nhân bị lỗi, việc đưa ra quyết định dựa trên câu trả lời chưa chính xác của AI, hay sự cố kỹ thuật từ các dịch vụ bên thứ ba).
          </p>
          <p>
            Quy định này hoàn toàn không làm giới hạn hay ảnh hưởng đến các quyền lợi cơ bản mà pháp luật bảo vệ người tiêu dùng dành cho bạn.
          </p>
        </Section>

        <Section id="cham-dut" title="10. Chấm dứt sử dụng và xóa tài khoản">
          <p>
            Bạn có thể ngừng sử dụng dịch vụ bất cứ lúc nào mà không gặp bất kỳ trở ngại nào.
          </p>
          <p>
            Nếu muốn xóa vĩnh viễn tài khoản cùng toàn bộ dữ liệu học tập đã lưu, bạn có thể tự thao tác ngay trong ứng dụng hoặc truy cập vào{" "}
            <Link
              className="text-emerald-300 hover:text-emerald-200 underline underline-offset-2"
              href="/account-deletion/"
            >
              trang xoá tài khoản
            </Link>
            .
          </p>
          <p>
            ZenStudy cũng có quyền tạm ngừng hoặc khóa tài khoản của bạn nếu bạn cố tình vi phạm các điều khoản này hoặc khi cơ quan pháp luật có yêu cầu.
          </p>
          <p>
            Ngay cả sau khi bạn đã ngừng sử dụng dịch vụ, các quy định liên quan đến bản quyền trí tuệ, giới hạn trách nhiệm và luật điều chỉnh vẫn tiếp tục duy trì hiệu lực.
          </p>
        </Section>

        <Section id="thay-doi" title="11. Thay đổi điều khoản">
          <p>
            Bản Điều khoản này có thể được điều chỉnh khi ZenStudy cập nhật các tính năng mới hoặc để phù hợp hơn với quy định pháp luật. Bản cập nhật mới nhất sẽ luôn được đăng tải công khai trên trang này kèm ngày sửa đổi.
          </p>
          <p>
            Đối với các thay đổi quan trọng ảnh hưởng trực tiếp đến quyền lợi của bạn, chúng tôi sẽ thông báo nổi bật trên trang chủ hoặc trong ứng dụng. Việc bạn tiếp tục sử dụng ZenStudy sau khi điều khoản được cập nhật đồng nghĩa với việc bạn đồng ý với các nội dung mới đó.
          </p>
        </Section>

        <Section id="lien-he" title="12. Luật điều chỉnh và thông tin liên hệ">
          <p>
            Điều khoản sử dụng này được điều chỉnh và giải thích theo quy định của pháp luật nước Cộng hòa Xã hội Chủ nghĩa Việt Nam.
          </p>
          <p>
            Mọi thắc mắc, phản hồi hoặc cần hỗ trợ về Điều khoản sử dụng, bạn vui lòng liên hệ trực tiếp với tác giả qua email:{" "}
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
