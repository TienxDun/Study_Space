interface StudyJsonLdProps {
  siteUrl?: string;
}

export function StudyJsonLd({
  siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://zenstudy.space",
}: StudyJsonLdProps) {
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "ZenStudy Space",
      alternateName: [
        "ZenStudy",
        "zenstudy.space",
        "Zen Study",
        "Không Gian Học Tập ZenStudy",
        "Lofi Virtual Study Space",
      ],
      url: `${siteUrl}/`,
      applicationCategory: "EducationalApplication, ProductivityApplication",
      operatingSystem: "All (Web Browser)",
      browserRequirements: "Requires JavaScript. Requires HTML5.",
      inLanguage: "vi-VN",
      isAccessibleForFree: true,
      description:
        "Không gian học tập tương tác nhập vai tại ZenStudy Space (zenstudy.space) với 30+ bối cảnh video sống động, 20 âm thanh môi trường thư giãn, danh sách nhạc Lo-fi/Jazz, đồng hồ Pomodoro, quản lý công việc và ghi chú nhanh.",
      image: `${siteUrl}/og-image.png`,
      screenshot: `${siteUrl}/og-image.png`,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "VND",
        availability: "https://schema.org/InStock",
      },
      featureList: [
        "30+ Bối cảnh video và ảnh nền sống động độ nét cao",
        "Bộ trộn 20 âm thanh môi trường thư giãn (mưa, sấm chớp, sóng biển, gió, tiếng lật sách, lò sưởi, quán cafe)",
        "Trình phát nhạc Lo-fi, Jazz và thư giãn không giới hạn",
        "Hỗ trợ nhúng video nhạc YouTube và playlist Spotify",
        "Đồng hồ Pomodoro thông minh kèm chuông báo Web Audio đa dạng",
        "Bảng quản lý công việc Kanban To-do list trực quan",
        "Sổ ghi chú nhanh Quick Notes hỗ trợ Markdown",
        "Chế độ Zen Mode ẩn toàn bộ phiền nhiễu chỉ với một phím tắt hoặc nút bấm",
      ],
      author: {
        "@type": "Person",
        name: "TienxDun",
        url: "https://github.com/TienxDun",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "ZenStudy Space",
      url: `${siteUrl}/`,
      logo: `${siteUrl}/icon.svg`,
      sameAs: ["https://github.com/TienxDun/Study_Space"],
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "ZenStudy Space",
      url: `${siteUrl}/`,
      inLanguage: "vi-VN",
      description:
        "Không gian học tập tương tác nhập vai giúp tăng cường khả năng tập trung và năng suất học tập.",
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "ZenStudy Space là gì?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "ZenStudy Space (zenstudy.space) là không gian học tập trực tuyến nhập vai (virtual study space) kết hợp bối cảnh sống động, âm thanh thiên nhiên, nhạc Lo-fi, Pomodoro timer và các công cụ ghi chú giúp bạn tập trung học bài và làm việc hiệu quả nhất.",
          },
        },
        {
          "@type": "Question",
          name: "Làm thế nào để sử dụng đồng hồ Pomodoro trên ZenStudy Space?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Nhấp vào cụm đồng hồ ở giữa màn hình hoặc mở thanh điều khiển, chọn chế độ Pomodoro (25 phút học, 5 phút nghỉ ngắn, 15 phút nghỉ dài) và bấm Bắt đầu. Bạn cũng có thể tùy chỉnh thời gian trong phần Cài đặt.",
          },
        },
        {
          "@type": "Question",
          name: "ZenStudy Space có những âm thanh môi trường nào để thư giãn?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Website tích hợp bộ trộn 20 âm thanh môi trường tự nhiên như tiếng mưa rơi, sấm sét, sóng biển, tiếng gió, tiếng lật sách trong thư viện, lò sưởi ấm cúng, quán cà phê và tiếng chim hót ban mai.",
          },
        },
        {
          "@type": "Question",
          name: "Sử dụng ZenStudy Space có mất phí không?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "ZenStudy Space hoàn toàn miễn phí 100%, không yêu cầu đăng nhập và không chứa quảng cáo gây phiền toái.",
          },
        },
        {
          "@type": "Question",
          name: "Tôi có thể nghe nhạc từ YouTube hoặc Spotify trên ZenStudy Space không?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Có. Ngoài danh sách nhạc Lo-fi và Jazz tích hợp sẵn, bạn có thể sử dụng công cụ Embed Player để nhúng trực tiếp bất kỳ video YouTube hoặc danh sách nhạc Spotify nào vào không gian học tập.",
          },
        },
        {
          "@type": "Question",
          name: "ZenStudy Space có dùng được trên điện thoại và máy tính bảng không?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Có, ZenStudy Space được tối ưu giao diện đáp ứng (responsive), hoạt động mượt mà trên mọi thiết bị từ máy tính, laptop đến điện thoại iOS và Android.",
          },
        },
        {
          "@type": "Question",
          name: "Dữ liệu công việc và ghi chú của tôi có được bảo mật không?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Toàn bộ danh sách công việc và ghi chú của bạn được lưu an toàn trực tiếp trên trình duyệt cá nhân của bạn (LocalStorage), hoàn toàn bảo mật và không bị gửi đi bất kỳ đâu.",
          },
        },
      ],
    },
  ];

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
