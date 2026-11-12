import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Chính sách quyền riêng tư",
  description:
    "ZenStudy Space dùng những thông tin gì khi bạn dùng web và ứng dụng Android: lưu trên máy, đồng bộ khi đăng nhập Google, trợ lý AI và phòng học nhóm.",
  alternates: { canonical: "/privacy/" },
  robots: { index: true, follow: true },
};

const UPDATED_AT = "12/11/2026";
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
          Tóm tắt nhanh cho bạn
        </p>
        <ul className="mt-2 space-y-1.5 text-sm text-slate-200 list-disc pl-5 marker:text-emerald-300">
          <li>Mặc định mọi dữ liệu học tập lưu ngay trên máy của bạn; bạn có thể dùng đầy đủ mà không bắt buộc tạo tài khoản.</li>
          <li>Đăng nhập bằng Google là tùy chọn, giúp bạn sao lưu dữ liệu và trò chuyện với trợ lý AI.</li>
          <li>Lịch sử trò chuyện với AI được lưu riêng trong tài khoản của bạn để bạn xem lại bất cứ lúc nào trên mọi thiết bị.</li>
          <li>Không bán dữ liệu, không gắn quảng cáo làm phiền. Công cụ đếm truy cập hoàn toàn ẩn danh, không dùng cookie và không theo dõi bạn sang trang web khác.</li>
          <li>Phòng học nhóm truyền hình ảnh và âm thanh trực tiếp; ZenStudy tuyệt đối không ghi âm, không ghi hình cuộc gọi.</li>
          <li>Tính năng báo cáo và chặn thành viên có sẵn ngay trong ứng dụng; thông tin báo cáo chỉ dùng để xem xét xử lý vi phạm và tự động xóa sau khoảng 180 ngày.</li>
          <li>Bạn có thể gửi góp ý hoặc báo lỗi ngay trong ứng dụng, kèm tối đa một ảnh chụp màn hình (nén sẵn, tối đa 1 MB); nội dung và ảnh chỉ quản trị viên đọc được và tự động xóa sau khoảng 180 ngày.</li>
        </ul>
      </div>

      <article className="mt-8 space-y-8">
        <Section id="gioi-thieu" title="1. Giới thiệu">
          <p>
            ZenStudy Space (gọi tắt là &ldquo;ZenStudy&rdquo;, &ldquo;chúng tôi&rdquo;) là
            không gian học tập trực tuyến giúp bạn tập trung và học tập hiệu quả, do tác giả Lều Tiến Dũng phát triển.
            Trang này giải thích một cách rõ ràng và minh bạch: ZenStudy sử dụng những thông tin nào khi bạn truy cập
            website và ứng dụng Android, cũng như cách bạn nắm toàn quyền kiểm soát dữ liệu của chính mình.
          </p>
          <p>
            Khi sử dụng ZenStudy, bạn đồng ý với cách chúng tôi quản lý và bảo vệ thông tin như được trình bày dưới đây.
          </p>
        </Section>

        <Section id="du-lieu-tren-thiet-bi" title="2. Thông tin lưu trên máy của bạn (thiết bị cá nhân)">
          <p>
            ZenStudy được thiết kế theo nguyên tắc ưu tiên thiết bị của bạn. Khi chưa đăng nhập tài khoản, toàn bộ dữ liệu chỉ nằm trong bộ nhớ trình duyệt web hoặc trong ứng dụng trên máy của bạn, bao gồm:
          </p>
          <ul className="list-disc pl-5 space-y-1 marker:text-slate-500">
            <li>Cài đặt không gian học: cảnh nền, âm thanh môi trường, âm lượng, chế độ giao diện sáng hoặc tối.</li>
            <li>Ghi chú học tập, danh sách việc cần làm (to-do list), liên kết video hoặc nhạc bạn tự dán vào (như YouTube, Spotify).</li>
            <li>Thống kê các phiên tập trung, đồng hồ Pomodoro và trạng thái xem hướng dẫn ban đầu.</li>
            <li>Ảnh gốc bạn đính kèm khi hỏi bài trợ lý AI (ảnh gốc luôn ở lại trên máy của bạn).</li>
          </ul>
          <p>Nếu bạn không đăng nhập tài khoản, toàn bộ dữ liệu này sẽ không bao giờ rời khỏi thiết bị của bạn.</p>
        </Section>

        <Section id="tai-khoan" title="3. Tài khoản và đăng nhập Google">
          <p>
            ZenStudy hỗ trợ đăng nhập qua nút chính thức của Google để bạn thuận tiện và an toàn nhất. Khi bạn đăng nhập, chúng tôi chỉ nhận các thông tin cơ bản do Google cung cấp:
          </p>
          <ul className="list-disc pl-5 space-y-1 marker:text-slate-500">
            <li>
              Mã số tài khoản nội bộ: một chuỗi ký tự ngẫu nhiên đại diện cho tài khoản của bạn (để hệ thống phân biệt bạn với người dùng khác, hoàn toàn không phải email hay mật khẩu của bạn).
            </li>
            <li>Địa chỉ email, tên hiển thị và ảnh đại diện Google (nếu có).</li>
          </ul>
          <p>
            Chúng tôi sử dụng những thông tin này để nhận diện bạn, đồng bộ không gian học của bạn giữa điện thoại và máy tính, đồng thời quản lý số lượt sử dụng trợ lý AI mỗi ngày. ZenStudy tuyệt đối không bao giờ nhận hay lưu mật khẩu Google của bạn.
          </p>
          <p className="text-xs text-slate-400">
            Tìm hiểu thêm:{" "}
            <a
              className="text-emerald-300 hover:text-emerald-200 underline underline-offset-2"
              href="https://firebase.google.com/support/privacy"
              target="_blank"
              rel="noreferrer"
            >
              Chính sách quyền riêng tư của dịch vụ đăng nhập Google
            </a>{" "}
            và{" "}
            <a
              className="text-emerald-300 hover:text-emerald-200 underline underline-offset-2"
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noreferrer"
            >
              Chính sách bảo mật chung của Google
            </a>
            .
          </p>
        </Section>

        <Section id="dong-bo" title="4. Đồng bộ dữ liệu khi đăng nhập">
          <p>
            Khi bạn đăng nhập, ZenStudy sẽ tự động tạo một bản sao lưu an toàn trên máy chủ của ZenStudy gắn với tài khoản của bạn, giúp bạn tiếp tục học tập liền mạch trên nhiều thiết bị. Bản sao lưu gồm: các thiết lập không gian học, ghi chú, danh sách việc cần làm, cảnh yêu thích, các liên kết nhúng và thời gian tập trung.
          </p>
          <p>
            Khi bạn bấm Đăng xuất: Ứng dụng sẽ dọn sạch dữ liệu tạm trên thiết bị đó để bảo vệ quyền riêng tư của bạn (rất an toàn khi bạn dùng chung máy tính với người khác). Bản sao lưu trên máy chủ vẫn được lưu giữ nguyên vẹn để tải lại đầy đủ ngay khi bạn đăng nhập lại.
          </p>
          <p>
            Cách xóa vĩnh viễn toàn bộ bản sao lưu được hướng dẫn ở mục 10. Lịch sử trò chuyện với trợ lý AI được lưu riêng trên hệ thống dữ liệu an toàn của Google (xem chi tiết ở mục 5), không gộp chung vào bản sao lưu này.
          </p>
        </Section>

        <Section id="tro-ly-ai" title="5. Trợ lý AI và lịch sử trò chuyện">
          <p>
            Khi bạn gửi câu hỏi, ảnh hoặc tệp cho trợ lý AI, nội dung được chuyển qua máy chủ của ZenStudy tới đối tác cung cấp dịch vụ trí tuệ nhân tạo (như hệ thống AI của Cloudflare hoặc Google) để xử lý và tạo câu trả lời hỗ trợ học tập cho bạn.
          </p>
          <p>
            Để bạn dễ dàng xem lại bài vở và các câu trả lời trên bất kỳ thiết bị nào, ZenStudy lưu lịch sử trò chuyện trên hệ thống dữ liệu của Google, gắn liền với tài khoản của bạn:
          </p>
          <ul className="list-disc pl-5 space-y-1 marker:text-slate-500">
            <li>Tên đoạn chat (được đặt tự động dựa theo câu hỏi đầu tiên của bạn) và thời gian tạo hoặc cập nhật.</li>
            <li>Nội dung tin nhắn bạn gửi và câu trả lời của AI (tối đa 8.000 ký tự cho mỗi tin nhắn).</li>
            <li>
              Với tệp hoặc hình ảnh đính kèm: hệ thống chỉ lưu tên tệp và một ảnh thu nhỏ (thumbnail) kích thước rất nhỏ để hiển thị trong khung trò chuyện. Ảnh gốc sắc nét của bạn luôn chỉ nằm trên máy của bạn và không bị tải lên máy chủ.
            </li>
            <li>Một đoạn trích ngắn (khoảng 200 ký tự đầu) của câu trả lời gần nhất để hiển thị xem trước trong danh sách chat.</li>
          </ul>
          <p>
            Cam kết riêng tư cho cuộc trò chuyện:
          </p>
          <ul className="list-disc pl-5 space-y-1 marker:text-slate-500">
            <li>Chỉ duy nhất bạn mới có quyền mở xem và xóa lịch sử trò chuyện của chính mình. ZenStudy không đọc trộm, không chia sẻ ra ngoài và không dùng nội dung riêng tư của bạn để huấn luyện bất kỳ mô hình AI nào.</li>
            <li>Bạn có thể chủ động bấm xóa từng cuộc trò chuyện bất cứ lúc nào trong ứng dụng — khi xóa, tất cả tin nhắn và ảnh thu nhỏ bên trong sẽ được xóa sạch ngay lập tức.</li>
            <li>Để đảm bảo dịch vụ hoạt động ổn định và công bằng cho mọi người, số lượt hỏi bài mỗi ngày được giới hạn hợp lý theo tài khoản.</li>
            <li>Các dịch vụ AI đối tác có thể xử lý nội dung theo quy định bảo mật riêng của họ; vì vậy, bạn vui lòng không gửi các thông tin bí mật cá nhân hay thông tin nhạy cảm.</li>
          </ul>
          <p>
            Bộ lọc an toàn tự động: Nhằm xây dựng không gian học tập an toàn cho các bạn học sinh từ đủ 16 tuổi trở lên, những câu hỏi có nguy cơ gây hại (như tự hại, bạo lực, chất cấm, nội dung người lớn) sẽ được hệ thống tự động ngăn chặn và gửi lời hướng dẫn an toàn thay vì gửi đến dịch vụ AI.
          </p>
          <p>Nếu bạn không mở tính năng trợ lý AI, sẽ không có bất kỳ tin nhắn nào được gửi đi.</p>
        </Section>

        <Section id="phong-hoc" title="6. Phòng học nhóm (Study Room)">
          <p>
            Phòng học nhóm kết nối bạn và bạn bè qua công nghệ gọi video trực tiếp để cùng nhau ngồi học. ZenStudy tuyệt đối không ghi âm, không ghi hình và không lưu lại bất kỳ hình ảnh hay âm thanh nào của cuộc gọi.
          </p>
          <p>
            Để phòng học vận hành ổn định và quản lý thời lượng, hệ thống chỉ ghi nhận một số thông tin kỹ thuật cơ bản: tên phòng, tên hiển thị của thành viên, thời điểm vào hoặc ra phòng và tổng thời gian học. Nếu bạn cài mật khẩu cho phòng học, mật khẩu đó được mã hóa an toàn, không ai (kể cả quản trị viên) có thể đọc được mật khẩu gốc của bạn.
          </p>
          <p>
            Lưu ý khi tham gia: Khi bạn bật micrô hoặc camera, các bạn học khác trong phòng sẽ nghe và nhìn thấy bạn. Bạn có toàn quyền chủ động bật hoặc tắt mic và camera bất cứ lúc nào.
          </p>
        </Section>

        <Section id="bao-cao" title="7. Báo cáo vi phạm, chặn thành viên và hạn chế tài khoản">
          <p>
            ZenStudy tích hợp sẵn các công cụ trực quan ngay trong ứng dụng để bạn chủ động bảo vệ trải nghiệm của mình:
          </p>
          <ul className="list-disc pl-5 space-y-1 marker:text-slate-500">
            <li>Báo cáo câu trả lời của trợ lý AI: Bạn chỉ cần bấm vào biểu tượng lá cờ ngay bên dưới câu trả lời không phù hợp.</li>
            <li>Báo cáo và chặn thành viên trong phòng học nhóm: Bạn bấm vào biểu tượng dấu ba chấm (&ldquo;⋮&rdquo;) trên thẻ của bạn học đó.</li>
          </ul>
          <p>Khi bạn gửi báo cáo, hệ thống sẽ lưu lại các thông tin cần thiết để quản trị viên đối chiếu và xử lý:</p>
          <ul className="list-disc pl-5 space-y-1 marker:text-slate-500">
            <li>
              Mã số tài khoản và tên hiển thị của bạn; nếu là báo cáo trong phòng học, sẽ có thêm mã số tài khoản và tên hiển thị của người bị phản ánh.
            </li>
            <li>
              Nội dung bị phản ánh: câu trả lời AI (tối đa 8.000 ký tự) cùng câu hỏi dẫn tới nó (tối đa 2.000 ký tự), hoặc mô tả hành vi không phù hợp trong phòng học.
            </li>
            <li>
              Lý do bạn chọn báo cáo, ghi chú giải thích thêm (nếu bạn có nhập, tối đa 500 ký tự), mã định danh của tin nhắn để xác minh chính xác, tên phòng học và thời gian gửi.
            </li>
          </ul>
          <p>
            Tính năng chặn (Block): Khi bạn bấm chặn một thành viên, việc chặn này có hiệu lực hai chiều (cả hai bạn sẽ không còn nhìn thấy nhau hay vào chung một phòng học nào nữa). Đồng thời, bạn sẽ tự động rời khỏi phòng học hiện tại ngay lập tức. Bạn có thể xem lại và bỏ chặn bất cứ lúc nào trong phần Cài đặt.
          </p>
          <p>
            Thời gian lưu trữ báo cáo: Báo cáo chỉ do người quản trị ZenStudy kiểm tra để giữ môi trường học tập an toàn. Thông tin báo cáo được lưu trữ tối đa khoảng 180 ngày để theo dõi và xử lý vi phạm, sau đó hệ thống sẽ tự động xóa sạch. Danh sách chặn được giữ cho đến khi bạn tự bỏ chặn hoặc khi bạn xóa tài khoản.
          </p>
          <p>
            Gửi góp ý và báo lỗi: Bạn có thể bấm &ldquo;Gửi góp ý&rdquo; trong phần Cài đặt (máy tính) hoặc mục &ldquo;Chung&rdquo; của bảng Thêm (điện thoại) để báo lỗi hay đề xuất cải thiện. Hệ thống lưu mã số tài khoản, tên hiển thị, loại góp ý, nội dung bạn viết (tối đa 2.000 ký tự), email liên hệ nếu bạn tự nguyện nhập, và vài thông tin kỹ thuật nhỏ để tìm lỗi (phiên bản ứng dụng, nền tảng web/Android, kích thước màn hình, ngôn ngữ). Bạn cũng có thể đính kèm một ảnh chụp màn hình mỗi lần gửi: ảnh được nén ngay trên máy xuống tối đa 1 MB, mỗi tài khoản gửi tối đa 3 ảnh mỗi ngày, và ảnh được lưu trong kho tệp của Cloudflare. Hãy cân nhắc che hoặc cắt bỏ thông tin riêng tư trước khi gửi ảnh. Góp ý không lưu địa chỉ IP hay thông tin trình duyệt đầy đủ, chỉ người quản trị ZenStudy đọc được, được lưu tối đa khoảng 180 ngày rồi tự động xóa (ảnh đính kèm bị xóa cùng).
          </p>
          <p>
            Trong quá trình xử lý, chúng tôi có thể tạm khóa tính năng trợ lý AI hoặc quyền vào phòng học của tài khoản có hành vi quấy rối. Khi bạn xóa tài khoản của mình, tất cả dữ liệu báo cáo, góp ý và danh sách chặn liên quan cũng sẽ được xóa sạch. Nếu bạn muốn phản ánh trực tiếp qua email, vui lòng xem mục 13.
          </p>
        </Section>

        <Section id="ha-tang" title="8. Máy chủ và nhật ký kỹ thuật">
          <p>
            ZenStudy sử dụng các nền tảng đám mây uy tín tiêu chuẩn quốc tế để duy trì hệ thống chạy mượt mà và an toàn:
          </p>
          <ul className="list-disc pl-5 space-y-1 marker:text-slate-500">
            <li>Dịch vụ máy chủ và lưu trữ đám mây của Cloudflare (chạy ứng dụng web, cơ sở dữ liệu đồng bộ và lưu trữ tệp).</li>
            <li>Dịch vụ đám mây của Google (xác thực tài khoản và lưu trữ an toàn lịch sử trò chuyện).</li>
            <li>Hạ tầng truyền phát âm thanh/hình ảnh phòng học trực tiếp và các nhà cung cấp mô hình AI.</li>
          </ul>
          <p>
            Để bảo vệ hệ thống trước các cuộc tấn công mạng và duy trì độ ổn định, các máy chủ có thể lưu tạm thời nhật ký kỹ thuật (như địa chỉ IP, loại trình duyệt, dòng thiết bị và các lỗi hệ thống phát sinh). Nhật ký lỗi kỹ thuật nội bộ của ZenStudy sẽ tự động xóa sau khoảng 14 ngày.
          </p>
          <p>
            Công cụ thống kê hoàn toàn ẩn danh (GoatCounter): Chúng tôi dùng công cụ GoatCounter để đếm số lượt xem trang và một số hành động chính (như bắt đầu phiên tập trung, vào phòng học, đăng nhập, gửi câu hỏi cho AI). Công cụ này tuyệt đối không dùng cookie, không nhận dạng bạn, không theo dõi bạn sang các trang web khác và không đọc nội dung bạn viết. Mọi số liệu chỉ dừng ở mức tổng quan (ví dụ: tổng lượt học trong ngày, quốc gia truy cập, loại thiết bị).
          </p>
          <p>
            ZenStudy cam kết không sử dụng cookie theo dõi cho mục đích quảng cáo thương mại.
          </p>
        </Section>

        <Section id="chia-se" title="9. Cam kết không bán dữ liệu và nguyên tắc chia sẻ">
          <p>Chúng tôi cam kết không bán, không cho thuê và không trao đổi dữ liệu cá nhân của bạn với bất kỳ bên nào.</p>
          <p>
            Dữ liệu chỉ được chuyển đến các nhà cung cấp hạ tầng kỹ thuật (được nêu ở mục 8) đúng ở mức tối thiểu để thực hiện các tính năng bạn đang dùng (đăng nhập, sao lưu đồng bộ, phòng học nhóm, trợ lý AI), hoặc khi có yêu cầu bắt buộc tuân thủ theo quy định của pháp luật.
          </p>
        </Section>

        <Section id="xoa-du-lieu" title="10. Quyền kiểm soát, sao lưu và xóa dữ liệu của bạn">
          <p className="font-semibold text-slate-200">Xóa dữ liệu trên thiết bị</p>
          <p>
            Bạn chỉ cần bấm &ldquo;Đăng xuất&rdquo; để dọn sạch dữ liệu tạm trên máy (đối với tài khoản khách chưa đăng nhập Google, thao tác đăng xuất sẽ xóa sạch toàn bộ dữ liệu trên máy). Bạn cũng có thể chủ động xóa dữ liệu trang web trong cài đặt trình duyệt hoặc gỡ cài đặt ứng dụng Android.
          </p>
          <p className="font-semibold text-slate-200">Xóa lịch sử trò chuyện AI</p>
          <p>
            Trong ứng dụng, bạn có thể xóa từng cuộc trò chuyện trong danh sách chat — toàn bộ tin nhắn và ảnh thu nhỏ trong cuộc trò chuyện đó sẽ được xóa ngay lập tức.
          </p>
          <p className="font-semibold text-slate-200">Xóa vĩnh viễn tài khoản và toàn bộ dữ liệu đồng bộ</p>
          <p>
            Bạn có thể tự xóa tài khoản bất cứ lúc nào:
          </p>
          <ul className="list-disc pl-5 space-y-1 marker:text-slate-500">
            <li>
              Ngay trong ứng dụng: Mở hồ sơ tài khoản (bấm vào ảnh đại diện ở thanh trên cùng; trên điện thoại vào mục &ldquo;Thêm&rdquo; → &ldquo;Tài khoản&rdquo;) rồi chọn &ldquo;Xoá tài khoản&rdquo;.
            </li>
            <li>
              Hoặc thực hiện trực tiếp trên trình duyệt tại{" "}
              <Link
                className="text-emerald-300 hover:text-emerald-200 underline underline-offset-2"
                href="/account-deletion/"
              >
                trang xoá tài khoản
              </Link>
              .
            </li>
          </ul>
          <p>
            Ngay khi bạn xác nhận xóa, toàn bộ bản sao lưu trên máy chủ ZenStudy, toàn bộ lịch sử trò chuyện AI trên Google và tài khoản đăng nhập của bạn sẽ bị xóa vĩnh viễn không thể khôi phục.
          </p>
          <p>
            Nếu không thể đăng nhập để tự thao tác, bạn chỉ cần gửi email tới{" "}
            <a
              className="text-emerald-300 hover:text-emerald-200 underline underline-offset-2"
              href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Xóa tài khoản ZenStudy")}`}
            >
              {CONTACT_EMAIL}
            </a>{" "}
            từ chính địa chỉ email bạn đã dùng để đăng nhập, tiêu đề &ldquo;Xóa tài khoản ZenStudy&rdquo;. Chúng tôi sẽ hỗ trợ xóa tài khoản và toàn bộ dữ liệu trong vòng tối đa 30 ngày.
          </p>
          <p className="font-semibold text-slate-200">Các quyền lợi khác của bạn</p>
          <p>
            Bạn luôn có quyền xem, chỉnh sửa, trích xuất hoặc yêu cầu xóa dữ liệu của mình, cũng như rút lại sự đồng ý bất kỳ lúc nào (bằng cách ngừng sử dụng hoặc đăng xuất khỏi ứng dụng). Bạn hãy gửi yêu cầu tới email liên hệ bên dưới nếu cần hỗ trợ.
          </p>
        </Section>

        <Section id="tre-em" title="11. Dành cho người học từ đủ 16 tuổi trở lên">
          <p>
            ZenStudy được xây dựng nhằm hỗ trợ việc tự học cho học sinh, sinh viên và người đi làm từ đủ 16 tuổi trở lên. Người dùng từ 16 đến dưới 18 tuổi vẫn là người chưa thành niên; một số nội dung có thể bị giới hạn vì mục đích an toàn, nhưng không cần thêm sự đồng ý của cha mẹ hay người giám hộ hợp pháp.
          </p>
          <p>
            Chúng tôi không cố ý thu thập thông tin của các em nhỏ dưới 16 tuổi; nếu phát hiện, hệ thống sẽ tiến hành xóa tài khoản và dữ liệu liên quan ngay lập tức.
          </p>
        </Section>

        <Section id="thay-doi" title="12. Thay đổi chính sách">
          <p>
            Chính sách quyền riêng tư có thể được cập nhật khi ZenStudy phát triển thêm tính năng mới hoặc nâng cấp hệ thống kỹ thuật. Bản cập nhật mới nhất luôn được hiển thị công khai trên trang này kèm theo ngày cập nhật. Với những thay đổi quan trọng ảnh hưởng đến quyền lợi của bạn, chúng tôi sẽ thông báo rõ ràng trong ứng dụng hoặc trên website.
          </p>
        </Section>

        <Section id="lien-he" title="13. Thông tin liên hệ">
          <p>
            Mọi câu hỏi, thắc mắc hay đóng góp ý kiến về sự riêng tư và bảo mật dữ liệu, bạn vui lòng gửi thư tới tác giả qua địa chỉ:{" "}
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
            href="/terms/"
            className="whitespace-nowrap text-slate-300 hover:text-white transition-colors"
          >
            Điều khoản sử dụng
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
