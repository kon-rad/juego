// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./LearnToken.sol";
import "./BadgeNFT.sol";

/**
 * @title QuizGame
 * @dev Core controller contract for juego.quest quiz game
 * Manages quiz results, token rewards, and badge minting
 */
contract QuizGame is AccessControl, ReentrancyGuard {
    bytes32 public constant GAME_SERVER_ROLE = keccak256("GAME_SERVER_ROLE");

    LearnToken public learnToken;
    BadgeNFT public badgeNFT;

    // Reward constants
    uint256 public constant TOKENS_PER_CORRECT_ANSWER = 10 * 10**18; // 10 LEARN per correct answer
    uint256 public constant BONUS_TOKENS_FOR_PASSING = 50 * 10**18; // 50 LEARN bonus for passing
    uint8 public constant MIN_CORRECT_FOR_BADGE = 5; // Minimum correct answers to earn badge

    // Quiz result storage
    struct QuizResult {
        uint8 correctAnswers;
        uint8 totalQuestions;
        bool rewardsClaimed;
        uint256 submittedAt;
        string quizName;
    }

    // player => quizId => QuizResult
    mapping(address => mapping(uint256 => QuizResult)) public quizResults;

    // Track total correct answers per player (for future cumulative rewards)
    mapping(address => uint256) public totalCorrectAnswers;

    // Track total tokens earned per player
    mapping(address => uint256) public totalTokensEarned;

    // Events
    event QuizResultSubmitted(
        address indexed player,
        uint256 indexed quizId,
        uint8 correctAnswers,
        uint8 totalQuestions,
        string quizName
    );
    event RewardsClaimed(
        address indexed player,
        uint256 indexed quizId,
        uint256 tokensAwarded,
        uint256 badgeTokenId
    );
    event TokensUpdated(address indexed oldToken, address indexed newToken);
    event BadgeNFTUpdated(address indexed oldBadge, address indexed newBadge);

    // Errors
    error ZeroAddress();
    error QuizAlreadyClaimed(uint256 quizId);
    error InsufficientScore(uint8 correctAnswers, uint8 required);
    error NoQuizResult(uint256 quizId);
    error QuizResultExists(uint256 quizId);

    constructor(address _learnToken, address _badgeNFT) {
        if (_learnToken == address(0) || _badgeNFT == address(0)) revert ZeroAddress();

        learnToken = LearnToken(_learnToken);
        badgeNFT = BadgeNFT(_badgeNFT);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(GAME_SERVER_ROLE, msg.sender);
    }

    /**
     * @dev Submit quiz result - only callable by game server
     * @param player The player's address
     * @param quizId The unique identifier for the quiz
     * @param correctCount Number of correct answers
     * @param totalQuestions Total questions in the quiz
     * @param quizName Name of the quiz for metadata
     */
    function submitQuizResult(
        address player,
        uint256 quizId,
        uint8 correctCount,
        uint8 totalQuestions,
        string calldata quizName
    ) external onlyRole(GAME_SERVER_ROLE) {
        if (player == address(0)) revert ZeroAddress();

        // Check if quiz result already exists and was claimed
        QuizResult storage existingResult = quizResults[player][quizId];
        if (existingResult.rewardsClaimed) {
            revert QuizAlreadyClaimed(quizId);
        }

        // Store/update the quiz result
        quizResults[player][quizId] = QuizResult({
            correctAnswers: correctCount,
            totalQuestions: totalQuestions,
            rewardsClaimed: false,
            submittedAt: block.timestamp,
            quizName: quizName
        });

        // Update total correct answers
        totalCorrectAnswers[player] += correctCount;

        emit QuizResultSubmitted(player, quizId, correctCount, totalQuestions, quizName);
    }

    /**
     * @dev Claim rewards for a completed quiz
     * @param quizId The quiz to claim rewards for
     */
    function claimRewards(uint256 quizId) external nonReentrant {
        QuizResult storage result = quizResults[msg.sender][quizId];

        // Check quiz result exists
        if (result.submittedAt == 0) revert NoQuizResult(quizId);

        // Check not already claimed
        if (result.rewardsClaimed) revert QuizAlreadyClaimed(quizId);

        // Check minimum score for badge
        if (result.correctAnswers < MIN_CORRECT_FOR_BADGE) {
            revert InsufficientScore(result.correctAnswers, MIN_CORRECT_FOR_BADGE);
        }

        // Mark as claimed
        result.rewardsClaimed = true;

        // Calculate token rewards
        uint256 tokensForCorrect = uint256(result.correctAnswers) * TOKENS_PER_CORRECT_ANSWER;
        uint256 totalTokens = tokensForCorrect + BONUS_TOKENS_FOR_PASSING;

        // Mint tokens
        learnToken.mint(msg.sender, totalTokens);
        totalTokensEarned[msg.sender] += totalTokens;

        // Mint badge NFT
        uint256 badgeTokenId = badgeNFT.mintBadge(
            msg.sender,
            quizId,
            result.correctAnswers,
            result.totalQuestions,
            result.quizName
        );

        emit RewardsClaimed(msg.sender, quizId, totalTokens, badgeTokenId);
    }

    /**
     * @dev Submit quiz result and auto-claim rewards in one transaction
     * Useful for gas efficiency and better UX
     */
    function submitAndClaim(
        address player,
        uint256 quizId,
        uint8 correctCount,
        uint8 totalQuestions,
        string calldata quizName
    ) external onlyRole(GAME_SERVER_ROLE) nonReentrant {
        if (player == address(0)) revert ZeroAddress();

        // Check if quiz result already exists and was claimed
        QuizResult storage existingResult = quizResults[player][quizId];
        if (existingResult.rewardsClaimed) {
            revert QuizAlreadyClaimed(quizId);
        }

        // Check minimum score
        if (correctCount < MIN_CORRECT_FOR_BADGE) {
            revert InsufficientScore(correctCount, MIN_CORRECT_FOR_BADGE);
        }

        // Store the quiz result as claimed
        quizResults[player][quizId] = QuizResult({
            correctAnswers: correctCount,
            totalQuestions: totalQuestions,
            rewardsClaimed: true,
            submittedAt: block.timestamp,
            quizName: quizName
        });

        // Update total correct answers
        totalCorrectAnswers[player] += correctCount;

        emit QuizResultSubmitted(player, quizId, correctCount, totalQuestions, quizName);

        // Calculate token rewards
        uint256 tokensForCorrect = uint256(correctCount) * TOKENS_PER_CORRECT_ANSWER;
        uint256 totalTokens = tokensForCorrect + BONUS_TOKENS_FOR_PASSING;

        // Mint tokens
        learnToken.mint(player, totalTokens);
        totalTokensEarned[player] += totalTokens;

        // Mint badge NFT
        uint256 badgeTokenId = badgeNFT.mintBadge(
            player,
            quizId,
            correctCount,
            totalQuestions,
            quizName
        );

        emit RewardsClaimed(player, quizId, totalTokens, badgeTokenId);
    }

    /**
     * @dev Get quiz result for a player
     */
    function getQuizResult(address player, uint256 quizId)
        external
        view
        returns (
            uint8 correctAnswers,
            uint8 totalQuestions,
            bool rewardsClaimed,
            uint256 submittedAt,
            string memory quizName
        )
    {
        QuizResult memory result = quizResults[player][quizId];
        return (
            result.correctAnswers,
            result.totalQuestions,
            result.rewardsClaimed,
            result.submittedAt,
            result.quizName
        );
    }

    /**
     * @dev Check if player can claim rewards for a quiz
     */
    function canClaimRewards(address player, uint256 quizId) external view returns (bool) {
        QuizResult memory result = quizResults[player][quizId];
        return result.submittedAt > 0 &&
               !result.rewardsClaimed &&
               result.correctAnswers >= MIN_CORRECT_FOR_BADGE;
    }

    /**
     * @dev Calculate potential rewards for a quiz result
     */
    function calculateRewards(uint8 correctAnswers)
        external
        pure
        returns (uint256 tokens, bool qualifiesForBadge)
    {
        if (correctAnswers < MIN_CORRECT_FOR_BADGE) {
            return (0, false);
        }
        uint256 tokensForCorrect = uint256(correctAnswers) * TOKENS_PER_CORRECT_ANSWER;
        return (tokensForCorrect + BONUS_TOKENS_FOR_PASSING, true);
    }

    // Admin functions
    function setLearnToken(address _learnToken) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_learnToken == address(0)) revert ZeroAddress();
        address oldToken = address(learnToken);
        learnToken = LearnToken(_learnToken);
        emit TokensUpdated(oldToken, _learnToken);
    }

    function setBadgeNFT(address _badgeNFT) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_badgeNFT == address(0)) revert ZeroAddress();
        address oldBadge = address(badgeNFT);
        badgeNFT = BadgeNFT(_badgeNFT);
        emit BadgeNFTUpdated(oldBadge, _badgeNFT);
    }

    function grantGameServerRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(GAME_SERVER_ROLE, account);
    }

    function revokeGameServerRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        revokeRole(GAME_SERVER_ROLE, account);
    }
}
