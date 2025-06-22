import { Text, Box } from "ink";
import { Badge } from "@inkjs/ui";

export default function AgentOutput(props: any) {
  const { output } = props;
  const AgentIcon = () => {
    return (
      <>
        <Badge color="yellow">AI agent:</Badge>
      </>
    );
  };

  return (
    <>
      <AgentIcon />

      <Box paddingLeft={1} borderStyle="round" borderColor="white">
        <Text>{output}</Text>
      </Box>
    </>
  );
}
