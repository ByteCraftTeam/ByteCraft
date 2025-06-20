def add_numbers(a, b):
    return a + b

# 示例用法
if __name__ == "__main__":
    num1 = float(input("请输入第一个数字: "))
    num2 = float(input("请输入第二个数字: "))
    result = add_numbers(num1, num2)
    print(f"两数之和为: {result}")