// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.28;

import {RobinhoodTypes} from "../types/RobinhoodTypes.sol";

interface ISafetyGuardian {
    function isPaused(RobinhoodTypes.PauseScope scope) external view returns (bool);
}
