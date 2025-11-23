// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title LearnToken
 * @dev ERC20 token rewarded to players for completing quizzes in juego.quest
 * Only the owner (deployer) can mint new tokens
 */
contract LearnToken is ERC20, Ownable {
    error ZeroAddress();

    constructor() ERC20("Learn Token", "LEARN") Ownable(msg.sender) {}

    /**
     * @dev Mint tokens to a player - only callable by owner
     * @param to The address to mint tokens to
     * @param amount The amount of tokens to mint
     */
    function mint(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        _mint(to, amount);
    }
}
