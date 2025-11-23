// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title LearnToken
 * @dev ERC20 token rewarded to players for completing quizzes in juego.quest
 * Only the QuizGame contract can mint new tokens
 */
contract LearnToken is ERC20, Ownable {
    address public quizGame;

    event QuizGameUpdated(address indexed oldQuizGame, address indexed newQuizGame);

    error OnlyQuizGame();
    error ZeroAddress();

    modifier onlyQuizGame() {
        if (msg.sender != quizGame) revert OnlyQuizGame();
        _;
    }

    constructor() ERC20("Learn Token", "LEARN") Ownable(msg.sender) {}

    /**
     * @dev Set the QuizGame contract address that is authorized to mint tokens
     * @param _quizGame The address of the QuizGame contract
     */
    function setQuizGame(address _quizGame) external onlyOwner {
        if (_quizGame == address(0)) revert ZeroAddress();
        address oldQuizGame = quizGame;
        quizGame = _quizGame;
        emit QuizGameUpdated(oldQuizGame, _quizGame);
    }

    /**
     * @dev Mint tokens to a player - only callable by QuizGame contract
     * @param to The address to mint tokens to
     * @param amount The amount of tokens to mint
     */
    function mint(address to, uint256 amount) external onlyQuizGame {
        _mint(to, amount);
    }
}
