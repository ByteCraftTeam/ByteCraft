import { Select, Alert } from "@inkjs/ui";
import { render, Text } from "ink";

export default function SelectModel(props: any) {
  const { models, showModelSelector, onModelSubmit } = props;

  return (
    <>
      {showModelSelector ? (
        <>
          <Select
            options={models}
            onChange={(value) => {
              onModelSubmit(value);
            }}
          />
          <Alert variant="info">请按esc键退出选择模型</Alert>
        </>
      ) : null}
    </>
  );
}
render(<SelectModel />);
