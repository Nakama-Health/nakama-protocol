// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.28;

import {RobinhoodTypes} from "../types/RobinhoodTypes.sol";

interface IDecisionModule {
    function consumeDecision(RobinhoodTypes.Decision calldata decision, bytes calldata signature)
        external
        returns (address signer);
}
