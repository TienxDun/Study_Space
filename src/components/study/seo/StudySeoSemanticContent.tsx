/**
 * Component Semantic HTML dành riêng cho SEO, Trợ năng (Screen Readers / A11y) và GEO (AI Engines).
 * Cung cấp cấu trúc Heading H1-H3 chuẩn, nội dung giàu từ khóa và giải thích chi tiết
 * mà không ảnh hưởng tới trải nghiệm giao diện người dùng (ẩn qua sr-only).
 */
export function StudySeoSemanticContent() {
  return (
    <div className="sr-only" aria-hidden="false">
      <header>
        <h1>ZenStudy Space - Không Gian Học Tập Tương Tác &amp; Tập Trung Tối Đa</h1>
        <p>
          Nền tảng không gian học tập ảo trực tuyến (Virtual Study Space) miễn phí tại zenstudy.space, được thiết kế
          để giúp học sinh, sinh viên và người làm việc nâng cao sự tập trung, chống trì hoãn và duy
          trì trạng thái dòng chảy tư duy (Flow State).
        </p>
      </header>

      <section>
        <h2>Các Tính Năng Trọng Tâm Hỗ Trợ Học Tập Hiệu Quả Trên ZenStudy Space</h2>

        <article>
          <h3>1. 50+ Bối Cảnh Video 4K &amp; Hình Nền Sống Động</h3>
          <p>
            Đắm chìm vào các không gian học bài đẹp mắt với chất lượng 4K: quán cà phê ngày mưa,
            phòng đọc sách cổ điển, phong cảnh anime chill, vũ trụ huyền ảo, thiên nhiên thanh bình
            và góc ban công đêm. Dễ dàng chuyển đổi giữa chế độ hình ảnh tĩnh và chuyển động.
          </p>
        </article>

        <article>
          <h3>2. Bộ Trộn 20 Âm Thanh Môi Trường Tự Nhiên (Ambient Sound Mixer)</h3>
          <p>
            Cá nhân hóa không gian âm thanh tập trung với tiếng mưa rơi trên mái tôn, mưa rào ngoài
            cửa sổ, sấm sét dịu êm, sóng biển vỗ bờ, gió reo qua rặng cây, tiếng lật sách trong thư
            viện, ngọn lửa tí tách trong lò sưởi và tiếng ồn trắng (white noise) chặn tạp âm xung quanh.
          </p>
        </article>

        <article>
          <h3>3. Đồng Hồ Pomodoro Thông Minh &amp; Bấm Giờ Stopwatch</h3>
          <p>
            Áp dụng phương pháp quả cà chua Pomodoro khoa học (25 phút tập trung cao độ, 5 phút nghỉ
            ngắn, 15 phút nghỉ dài). Tích hợp chuông báo Web Audio du dương như chuông thiền Zen,
            tiếng chim hót và chuông chuông ngân vang, giúp bạn duy trì kỷ luật học tập.
          </p>
        </article>

        <article>
          <h3>4. Trình Phát Nhạc Lo-fi, Jazz &amp; Nhúng YouTube, Spotify</h3>
          <p>
            Kho nhạc Lo-fi Hip Hop thư giãn, piano êm dịu và jazz cổ điển giúp kích thích sóng não
            Alpha. Hỗ trợ nhúng video nhạc YouTube và danh sách bài hát Spotify yêu thích với trình
            phát nổi tiện lợi.
          </p>
        </article>

        <article>
          <h3>5. Bảng Quản Lý Công Việc Kanban &amp; Sổ Ghi Chú Markdown</h3>
          <p>
            Lập kế hoạch học tập với bảng công việc To-do list kéo thả trực quan, thiết lập độ ưu tiên
            và hạn chót. Ghi chép bài học nhanh chóng bằng trình soạn thảo Markdown mượt mà, lưu trữ
            cục bộ an toàn và bảo mật ngay trên trình duyệt của bạn.
          </p>
        </article>

        <article>
          <h3>6. Chế Độ Zen Mode</h3>
          <p>
            Loại bỏ hoàn toàn các nút bấm, widget và thanh điều khiển để thưởng thức không gian học
            bài tối giản, không phân tâm.
          </p>
        </article>
      </section>

      <section>
        <h2>Câu Hỏi Thường Gặp Về ZenStudy Space (FAQ)</h2>
        <dl>
          <dt>ZenStudy Space có miễn phí không?</dt>
          <dd>
            Hoàn toàn miễn phí 100%. Mọi tính năng từ bối cảnh 4K, âm thanh thiên nhiên đến Pomodoro
            đều được mở khóa sẵn mà không có quảng cáo.
          </dd>

          <dt>Phương pháp Pomodoro trên web hoạt động như thế nào?</dt>
          <dd>
            Bạn chọn thời gian tập trung (mặc định 25 phút), đồng hồ sẽ đếm ngược và phát chuông êm dịu
            khi đến giờ nghỉ giải lao 5 phút, sau 4 chu kỳ sẽ là một kỳ nghỉ dài 15 phút.
          </dd>

          <dt>Dữ liệu công việc và ghi chú của tôi có được bảo mật không?</dt>
          <dd>
            Toàn bộ danh sách công việc, ghi chú và tùy chọn cá nhân được lưu trữ an toàn trong
            LocalStorage của trình duyệt bạn, không gửi về bất kỳ máy chủ bên thứ ba nào.
          </dd>
        </dl>
      </section>

      <footer>
        <p>ZenStudy Space (zenstudy.space) - Phát triển độc lập bởi TienxDun. Dự án mã nguồn mở phục vụ cộng đồng học tập.</p>
      </footer>
    </div>
  );
}
