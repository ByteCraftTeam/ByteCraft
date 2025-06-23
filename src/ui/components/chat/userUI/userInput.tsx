import { Text, Box } from "ink";
import { TextInput, Badge } from "@inkjs/ui";

export default function UserInput(props: any) {
  const { submitInput, onInputChange, input } = props;

  const UserIcon = () => {
    return (
      <>
        <Badge color="blue">user:</Badge>
      </>
    );
  };

  return (
    <>
      <Box paddingLeft={1}>
        <Text>请输入您的问题</Text>
      </Box>
      <UserIcon />
      <Box paddingLeft={1} borderStyle="round" borderColor="white">
        <TextInput
          key={input}
          placeholder="请在此输入"
          defaultValue=""
          onChange={(input) => {
            onInputChange(input);
          }}
          onSubmit={(input) => {
            submitInput(input);
          }}
        />
      </Box>
    </>
  );
}
