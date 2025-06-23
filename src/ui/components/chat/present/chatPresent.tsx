import UserInput from "../userUI/userInput.js";
import { useEffect, useState } from "react";

export default function ChatPresent(props: any) {
  const {
    onInputSubmit = () => {},
    onModelSubmit = () => {},
    showChat,
    input,
  } = props;

  const [presentInput, setPresentInput] = useState(input);
  const [model, setModel] = useState("deepseek-r1");

  const onInputChange = (input: string) => {
    if (input === "/model" || input === "/new") {
      setPresentInput(input);
      onInputSubmit(input);
    }
  };

  const submitInput = (input: string) => {
    setPresentInput(input);
    onInputSubmit(input);
  };

  const submitModel = (model: string) => {
    setModel(model);
    onModelSubmit(model);
  };

  return (
    <>
      {showChat ? (
        <UserInput
          submitModel={submitModel}
          submitInput={submitInput}
          onInputChange={onInputChange}
          input={input}
        />
      ) : null}
    </>
  );
}
