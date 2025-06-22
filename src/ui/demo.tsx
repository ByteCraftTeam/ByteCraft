import { Select, TextInput } from "@inkjs/ui";
import { useInput, render, Text } from "ink";
import { useState } from "react";
import { exit } from "process";

export default function Demo() {
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [currentModel, setCurrentModel] = useState("");

  useInput((input, key) => {
    if (key.escape) {
      if (showModelSelector) {
        setShowModelSelector(false);
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
      if (!showModelSelector && inputValue === "/model") {
        setShowModelSelector(true);
      }
    }
  });
  return (
    <>
      <TextInput
        placeholder="input"
        onChange={(value) => {
          setInputValue(value);
        }}
      />
      {showModelSelector ? (
        <Select
          options={[
            {
              label: "DeepSeek R1 模型",
              value: "deepseek-r1",
            },
            {
              label: "DeepSeek V3 模型",
              value: "deepseek-v3",
            },
            {
              label: "Moonshot 模型",
              value: "moonshot",
            },
            {
              label: "豆包模型",
              value: "doubao",
            },
          ]}
          onChange={(value) => {
            setCurrentModel(value);
          }}
        />
      ) : null}
    </>
  );
}
render(<Demo />);
