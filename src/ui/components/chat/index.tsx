import { render, Box, Text, useInput } from "ink";
import ChatPresent from "./present/chatPresent";
import { useState, useEffect } from "react";
import { exit } from "process";

import ChatHistroyList from "./present/chatHistoryList";
import SelectModel from "../selectModel";

export default function Chat() {
  const [chatList, setChatList] = useState([{}]);
  const [presentInput, setPresentInput] = useState(""); //正常对话的state
  const [presentOutput, setPresentOutput] = useState("");
  const [presentModel, setPresentModel] = useState("deepseek-r1");
  const [showModelSelector, setShowModelSelector] = useState(false);
  const inputDemo = { input: "" }; //特殊指令的state

  //可供选择的大模型种类
  const models = [
    {
      value: "deepseek-r1",
      label: "DeepSeek R1 模型",
    },
    {
      value: "deepseek-v3",
      label: "DeepSeek V3 模型",
    },
    {
      value: "moonshot",
      label: "Moonshot 模型",
    },
    {
      value: "doubao",
      label: "豆包模型",
    },
  ];

  //调用大模型
  const agentAnlysis = (input: string) => {
    let output = "";

    for (let i = 0; i < input.length; i++) {
      const outputArray = output.split("");
      outputArray.push("b");
      output = outputArray.join("");
    }
    return output;
  };

  //处理下层组件向上传递的输入框参数
  const onInputSubmit = (input: string) => {
    if (!input) {
      return;
    }

    if (input === "/model" || input === "/new") {
      inputDemo.input = input;
      return;
    }
    const output = agentAnlysis(input);
    const newChat = { input, output };
    const newChatList =
      JSON.stringify(chatList[0]) !== JSON.stringify({})
        ? [...chatList, newChat]
        : [newChat];

    setChatList(newChatList);
    setPresentInput(input);
    setPresentOutput(output);
  };
  //   if (!input) {
  //     return;
  //   }

  //   if (input === "/model" || input === "/new") {
  //     setPresentInput(input);
  //     return;
  //   }

  //   const newChat = { input, output };
  //   const newChatList =
  //     JSON.stringify(chatList[0]) !== JSON.stringify({})
  //       ? [...chatList, newChat]
  //       : [newChat];

  //   setChatList(newChatList);
  //   setPresentInput(input);
  //   setPresentOutput(output);
  // };

  const onModelSubmit = (model: string) => {
    setPresentModel(model);
  };

  //分割线
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

  //监听用户输入
  useInput((input, key) => {
    if (key.escape) {
      if (showModelSelector) {
        setShowModelSelector(false);
        setPresentInput("");
      } else {
        process.stdout.write("\x1Bc");
        exit();
      }
    }

    if (key.ctrl && input === "c") {
      process.stdout.write("\x1Bc");
      exit();
    }

    if (key.return) {
      //切换模型（/model）快捷键
      if (!showModelSelector && inputDemo.input === "/model") {
        setShowModelSelector(true);
      }
      //新建对话（/new）快捷键
      if (!showModelSelector && inputDemo.input === "/new") {
        setChatList([{}]);
        setPresentInput("");
        setPresentOutput("");
        setPresentModel("deepseek-r1");
      }
    }
  });

  return (
    <>
      <ChatHistroyList chatList={chatList} />
      <Divider />
      <Text>当前模型：{presentModel}</Text>
      <SelectModel
        onModelSubmit={onModelSubmit}
        showModelSelector={showModelSelector}
        models={models}
      />
      <ChatPresent
        showChat={!showModelSelector}
        onInputSubmit={onInputSubmit}
        onModelSubmit={onModelSubmit}
        input={presentInput}
      />
    </>
  );
}
render(<Chat />);
