import type { PrivacySection } from "./privacy"

export const PRIVACY_VI: PrivacySection[] = [
  {
    id: "collect",
    title: "1. Dữ liệu chúng tôi thu thập",
    paragraphs: ["Chúng tôi chỉ thu thập dữ liệu cần thiết để vận hành cửa hàng và giao sản phẩm bạn đã mua:"],
    bullets: [
      "Tài khoản — khi bạn đăng nhập bằng Discord hoặc Google, chúng tôi nhận tên người dùng, email, ảnh đại diện và mã tài khoản từ nhà cung cấp (chúng tôi không bao giờ nhận hoặc lưu mật khẩu của bạn)",
      "Đơn hàng — sản phẩm, gói, số tiền, phương thức thanh toán, ngày giờ, trạng thái và tên người dùng Roblox dùng để cấp quyền truy cập",
      "Chương trình máy tính — mã máy (HWID) để liên kết giấy phép với thiết bị của bạn",
      "Nội dung bạn tạo — đánh giá, mục yêu thích, ảnh đã tải lên và dự án trong trình tạo ảnh livestream",
      "Dữ liệu kỹ thuật — cookie phiên đăng nhập, lựa chọn ngôn ngữ/giao diện và mã giới thiệu nếu bạn truy cập qua liên kết tiếp thị liên kết",
    ],
  },
  {
    id: "use",
    title: "2. Cách chúng tôi sử dụng dữ liệu",
    bullets: [
      "Giao sản phẩm — cấp quyền truy cập, gửi khóa, kích hoạt giấy phép chương trình và hiển thị lịch sử đơn hàng",
      "Xác minh thanh toán, giải quyết sự cố và hỗ trợ khách hàng",
      "Tính hoa hồng tiếp thị liên kết — cộng tác viên chỉ thấy số liệu tổng hợp, không thấy thông tin người mua",
      "Gửi tin tức và khuyến mãi chỉ khi bạn tự đăng ký; bạn có thể hủy đăng ký bất cứ lúc nào",
      "Cải thiện dịch vụ và ngăn chặn lạm dụng như chia sẻ giấy phép giữa nhiều thiết bị",
    ],
  },
  {
    id: "payment",
    title: "3. Thanh toán",
    paragraphs: [
      "Thanh toán được xử lý bởi nhà cung cấp bên thứ ba: Stripe (thẻ và PromptPay) và PayPal. Thông tin thẻ của bạn được nhập và lưu trực tiếp tại các nhà cung cấp đó — chúng tôi không bao giờ xem hoặc lưu số thẻ.",
      "Chúng tôi chỉ lưu trạng thái thanh toán, số tiền, phí và mã tham chiếu giao dịch để xác nhận đơn hàng và giải quyết tranh chấp.",
    ],
  },
  {
    id: "share",
    title: "4. Chia sẻ với bên khác",
    paragraphs: ["Chúng tôi không bán hoặc cho thuê dữ liệu cá nhân của bạn. Dữ liệu chỉ được chia sẻ trong các trường hợp sau:"],
    bullets: [
      "Nhà cung cấp thanh toán (Stripe, PayPal) và nhà cung cấp đăng nhập (Discord, Google), theo chính sách quyền riêng tư của từng bên",
      "Game đối tác — khi mua game của đối tác, bạn hoàn tất giao dịch trên website của đối tác; thông tin nhập tại đó chịu sự điều chỉnh của chính sách đối tác",
      "Khi pháp luật yêu cầu hoặc để bảo vệ quyền lợi và sự an toàn của cửa hàng cùng người dùng khác",
    ],
  },
  {
    id: "cookies",
    title: "5. Cookie và lưu trữ trên trình duyệt",
    bullets: [
      "Cookie phiên để duy trì trạng thái đăng nhập (được xóa khi bạn đăng xuất)",
      "Tùy chọn được ghi nhớ trên trình duyệt như ngôn ngữ và giao diện — các dữ liệu này không được gửi cho chúng tôi",
      "Mã giới thiệu tiếp thị liên kết được lưu tạm thời để ưu đãi và hoa hồng được tính đúng người",
      "Chúng tôi không sử dụng cookie quảng cáo hoặc công cụ theo dõi của bên thứ ba",
    ],
  },
  {
    id: "retention",
    title: "6. Thời gian lưu trữ và bảo mật",
    bullets: [
      "Dữ liệu tài khoản và nội dung bạn tạo được lưu khi tài khoản còn hoạt động",
      "Hồ sơ đơn hàng và thanh toán được lưu theo yêu cầu kế toán và nghĩa vụ pháp lý",
      "Mọi kết nối đều sử dụng HTTPS và quyền truy cập dữ liệu chỉ dành cho quản trị viên",
    ],
  },
  {
    id: "rights",
    title: "7. Quyền của bạn",
    bullets: [
      "Xem và sửa tên hiển thị trên trang tài khoản; xóa đánh giá, mục yêu thích và dự án của bạn bất cứ lúc nào",
      "Yêu cầu bản sao, chỉnh sửa hoặc xóa tài khoản và dữ liệu qua các kênh liên hệ bên dưới — chúng tôi phản hồi trong vòng 30 ngày (hồ sơ đơn hàng cần lưu theo luật có thể vẫn được giữ lại)",
      "Hủy đăng ký nhận tin bất cứ lúc nào qua liên kết trong email hoặc liên hệ với chúng tôi",
    ],
  },
  {
    id: "children",
    title: "8. Người chưa thành niên",
    paragraphs: ["Dịch vụ dành cho người dùng từ 13 tuổi trở lên. Người dưới 20 tuổi nên có sự đồng ý của cha mẹ hoặc người giám hộ trước khi thanh toán. Nếu phát hiện đã thu thập dữ liệu trẻ em khi chưa có sự đồng ý, chúng tôi sẽ nhanh chóng xóa dữ liệu đó."],
  },
  {
    id: "changes",
    title: "9. Thay đổi chính sách",
    paragraphs: ["Chúng tôi có thể cập nhật chính sách này theo thời gian; ngày có hiệu lực được hiển thị ở đầu trang. Tiếp tục sử dụng sau ngày đó có nghĩa là bạn ghi nhận chính sách đã cập nhật."],
  },
  {
    id: "contact",
    title: "10. Liên hệ với chúng tôi",
    paragraphs: ["Bạn có câu hỏi về dữ liệu hoặc muốn thực hiện quyền theo mục 7? Hãy liên hệ đội ngũ trên Discord hoặc qua các kênh trên trang liên hệ."],
  },
]
