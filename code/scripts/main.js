document.addEventListener("DOMContentLoaded", () => {
    console.log("个人网页加载完成！");

    // 示例：添加动态功能
    const header = document.querySelector("header");
    if (header) {
        header.addEventListener("click", () => {
            console.log("Header 被点击了！");
        });
    }
});
