# Database Reference — không áp dụng

Frontend BLUE không sở hữu database, migration hoặc ORM. Các nội dung này thuộc dự án khác và không được đưa vào backlog frontend.

Trong giai đoạn mock:

- Entity frontend được định nghĩa theo use case và `API_CONTRACT.md`, không theo bảng database.
- MSW fixtures không được coi là schema database production.
- Component không dùng tên cột hoặc phụ thuộc cấu trúc persistence.
- Component và page không truy cập trực tiếp kho fixture; chúng đi qua service/query hook của frontend.

File được giữ để đáp ứng cấu trúc tài liệu của template; không cần mở rộng trong dự án frontend này.
