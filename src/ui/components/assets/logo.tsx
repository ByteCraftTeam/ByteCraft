import { render } from "ink";
import { TextInput } from "@inkjs/ui";

export default function Logo() {
  return (
    <>
      <TextInput
        placeholder="请输入您的名字..."
        onSubmit={(name) => {
          console.log(name);
        }}
      />
    </>
  );
}
render(<Logo></Logo>);
