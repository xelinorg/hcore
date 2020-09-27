HTTP2 has introduced a layer of state on top of TCP that needs to be addressed.

This documents is a draft and its intent is to help with the implementation of the overall state management required when we need sane http2 communications.

Firstly we have the [streams](https://httpwg.org/specs/rfc7540.html#StreamsLayer) that have a stream identifier. Each endpoint should know which are in use in order to pick a not used identifier when wants to communicate with the remote endpoint.

The streams themselves have state (idle, reserved, open, closed) and each endpoint should know this state to evaluate the correctness of the communication and apply the required flow control. [Streams have priorities](https://httpwg.org/specs/rfc7540.html#PRIORITY) as well that should be traced as it could change during the lifetime of the session.

The second aspect that introduces a need for state management is the [settings](https://httpwg.org/specs/rfc7540.html#SettingValues) that initiate and govern an established connection. These are send by the client when starting a new connection and should be acknowledged by the server. Settings are vital for flow control and could change during the lifetime of the connection by both endpoints.

The last realm that has state and needs management is the  [dynamic table of HPACK](https://httpwg.org/specs/rfc7541.html#dynamic.table).

The connection as a whole has a state and the [rfc7540](https://httpwg.org/specs/rfc7540.html) depicts that. For instance on the priorities section of the rfc is stated that ***"The PRIORITY frame can be sent on a stream in any state, though it cannot be sent between consecutive frames that comprise a single header block"***.
