import { render, Box, Text } from "ink";
import ChatPresent from "./chat/present/chatPresent";
import { useState, useEffect } from "react";
import ChatHistoryList from "./chat/present/chatHistoryList";

export default function Chat() {
  const [chatList, setChatList] = useState([{}]);
  const [presentInput, setPresentInput] = useState("");
  const [presentOutput, setPresentOutput] = useState("");

  const onChange = (input: string, output: string) => {
    if (!input || !output) {
      return;
    }
    const newChat = { input, output };
    const newChatList =
      JSON.stringify(chatList[0]) !== JSON.stringify({})
        ? [...chatList, newChat]
        : [newChat];

    setChatList(newChatList);
    setPresentInput(input);
    setPresentOutput(output);
  };

  const Divider = ({ title = "histroy divider", color = "blue" }) => {
    const terminalWidth = process.stdout.columns || 80;
    const lineLength = Math.floor(
      (terminalWidth - (title ? title.length + 2 : 0)) / 2
    );
    const line = "─".repeat(lineLength);
    if (JSON.stringify(chatList[0]) === JSON.stringify({})) {
      return <></>;
    }
    return (
      <Box>
        <Text color={color}>
          {line}
          {title && ` ${title} `}
          {line}
        </Text>
      </Box>
    );
  };

  // 监听程序退出事件
  useEffect(() => {
    const handleExit = () => {
      process.stdout.write("\x1Bc");
    };

    const handleBeforeExit = () => {
      process.stdout.write("\x1Bc");
    };

    process.on("exit", handleExit);
    process.on("beforeExit", handleBeforeExit);
    process.on("SIGINT", () => {
      process.stdout.write("\x1Bc");
      process.exit(0);
    });
    process.on("SIGTERM", () => {
      process.stdout.write("\x1Bc");
      process.exit(0);
    });

    return () => {
      process.off("exit", handleExit);
      process.off("beforeExit", handleBeforeExit);
    };
  }, []);

  return (
    <>
      <ChatHistoryList chatList={chatList} />
      <Divider />
      <ChatPresent
        onChange={onChange}
        input={presentInput}
        output={presentOutput}
      />
    </>
  );
}
render(<Chat />);
