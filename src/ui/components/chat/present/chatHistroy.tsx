import { Box, Text } from "ink";
import { Badge } from "@inkjs/ui";

import AgentOutput from "../agentUI/agentOutput";
export default function ChatHistory(props: any) {
  const { input, output } = props;
  const UserIcon = () => {
    return (
      <>
        <Badge color="blue">user:</Badge>
      </>
    );
  };
  if (!input || input == "") {
    return <></>;
  }

  return (
    <>
      <UserIcon />
      <Box paddingLeft={1} borderStyle="round" borderColor="white">
        <Text>{input}</Text>
      </Box>
      <AgentOutput output={output} />
    </>
  );
}
