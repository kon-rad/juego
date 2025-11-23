// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

/**
 * @title BadgeNFT
 * @dev Tradable ERC721 NFT badges awarded for completing quizzes in juego.quest
 * Each badge represents completing a specific quiz with a certain score tier
 */
contract BadgeNFT is ERC721, ERC721Enumerable, Ownable {
    using Strings for uint256;

    address public quizGame;
    uint256 private _nextTokenId;
    string public baseURI;

    // Badge metadata
    struct BadgeData {
        uint256 quizId;
        uint8 correctAnswers;
        uint8 totalQuestions;
        uint256 completedAt;
        string quizName;
    }

    // Mapping from tokenId to badge data
    mapping(uint256 => BadgeData) public badges;

    // Mapping to check if a player has a badge for a specific quiz
    mapping(address => mapping(uint256 => bool)) public hasBadgeForQuiz;

    // Mapping from player to their badge token IDs for each quiz
    mapping(address => mapping(uint256 => uint256)) public playerQuizBadge;

    event BadgeMinted(
        address indexed player,
        uint256 indexed tokenId,
        uint256 indexed quizId,
        uint8 correctAnswers,
        string tier
    );
    event QuizGameUpdated(address indexed oldQuizGame, address indexed newQuizGame);
    event BaseURIUpdated(string oldBaseURI, string newBaseURI);

    error OnlyQuizGame();
    error ZeroAddress();

    modifier onlyQuizGame() {
        if (msg.sender != quizGame) revert OnlyQuizGame();
        _;
    }

    constructor() ERC721("Juego Quest Badge", "BADGE") Ownable(msg.sender) {
        baseURI = "";
    }

    /**
     * @dev Set the QuizGame contract address
     */
    function setQuizGame(address _quizGame) external onlyOwner {
        if (_quizGame == address(0)) revert ZeroAddress();
        address oldQuizGame = quizGame;
        quizGame = _quizGame;
        emit QuizGameUpdated(oldQuizGame, _quizGame);
    }

    /**
     * @dev Set the base URI for token metadata
     */
    function setBaseURI(string memory _baseURI) external onlyOwner {
        string memory oldBaseURI = baseURI;
        baseURI = _baseURI;
        emit BaseURIUpdated(oldBaseURI, _baseURI);
    }

    /**
     * @dev Mint a badge NFT to a player - only callable by QuizGame contract
     */
    function mintBadge(
        address to,
        uint256 quizId,
        uint8 correctAnswers,
        uint8 totalQuestions,
        string memory quizName
    ) external onlyQuizGame returns (uint256) {
        uint256 tokenId = _nextTokenId++;

        badges[tokenId] = BadgeData({
            quizId: quizId,
            correctAnswers: correctAnswers,
            totalQuestions: totalQuestions,
            completedAt: block.timestamp,
            quizName: quizName
        });

        hasBadgeForQuiz[to][quizId] = true;
        playerQuizBadge[to][quizId] = tokenId;

        _safeMint(to, tokenId);

        string memory tier = _getTier(correctAnswers, totalQuestions);
        emit BadgeMinted(to, tokenId, quizId, correctAnswers, tier);

        return tokenId;
    }

    /**
     * @dev Get the tier based on score
     */
    function _getTier(uint8 correct, uint8 total) internal pure returns (string memory) {
        if (total == 0) return "Basic";
        uint256 percentage = (uint256(correct) * 100) / uint256(total);
        if (percentage == 100) return "Perfect";
        if (percentage >= 80) return "Expert";
        if (percentage >= 60) return "Advanced";
        return "Basic";
    }

    /**
     * @dev Get tier for a badge
     */
    function getBadgeTier(uint256 tokenId) public view returns (string memory) {
        BadgeData memory badge = badges[tokenId];
        return _getTier(badge.correctAnswers, badge.totalQuestions);
    }

    /**
     * @dev Generate on-chain SVG for the badge
     */
    function _generateSVG(uint256 tokenId) internal view returns (string memory) {
        BadgeData memory badge = badges[tokenId];
        string memory tier = _getTier(badge.correctAnswers, badge.totalQuestions);

        string memory tierColor;
        if (keccak256(bytes(tier)) == keccak256(bytes("Perfect"))) {
            tierColor = "#FFD700"; // Gold
        } else if (keccak256(bytes(tier)) == keccak256(bytes("Expert"))) {
            tierColor = "#C0C0C0"; // Silver
        } else if (keccak256(bytes(tier)) == keccak256(bytes("Advanced"))) {
            tierColor = "#CD7F32"; // Bronze
        } else {
            tierColor = "#4A90D9"; // Blue
        }

        return string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">',
            '<defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">',
            '<stop offset="0%" style="stop-color:#1a1a2e"/>',
            '<stop offset="100%" style="stop-color:#16213e"/>',
            '</linearGradient></defs>',
            '<rect width="400" height="400" fill="url(#bg)"/>',
            '<circle cx="200" cy="150" r="80" fill="', tierColor, '" opacity="0.9"/>',
            '<text x="200" y="160" text-anchor="middle" fill="#1a1a2e" font-size="48" font-weight="bold">',
            uint256(badge.correctAnswers).toString(), '/', uint256(badge.totalQuestions).toString(),
            '</text>',
            '<text x="200" y="270" text-anchor="middle" fill="white" font-size="24" font-weight="bold">',
            badge.quizName,
            '</text>',
            '<text x="200" y="310" text-anchor="middle" fill="', tierColor, '" font-size="20">',
            tier, ' Tier',
            '</text>',
            '<text x="200" y="370" text-anchor="middle" fill="#888" font-size="14">Juego Quest Badge #',
            tokenId.toString(),
            '</text></svg>'
        ));
    }

    /**
     * @dev Returns the token URI with on-chain metadata
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);

        BadgeData memory badge = badges[tokenId];
        string memory tier = _getTier(badge.correctAnswers, badge.totalQuestions);
        string memory svg = _generateSVG(tokenId);

        string memory json = string(abi.encodePacked(
            '{"name": "Juego Quest Badge #', tokenId.toString(),
            '", "description": "A badge earned by completing a quiz on Juego Quest",',
            '"image": "data:image/svg+xml;base64,', Base64.encode(bytes(svg)), '",',
            '"attributes": [',
            '{"trait_type": "Quiz ID", "value": "', badge.quizId.toString(), '"},',
            '{"trait_type": "Quiz Name", "value": "', badge.quizName, '"},',
            '{"trait_type": "Score", "value": "', uint256(badge.correctAnswers).toString(), '/', uint256(badge.totalQuestions).toString(), '"},',
            '{"trait_type": "Tier", "value": "', tier, '"},',
            '{"trait_type": "Completed At", "display_type": "date", "value": ', badge.completedAt.toString(), '}',
            ']}'
        ));

        return string(abi.encodePacked(
            "data:application/json;base64,",
            Base64.encode(bytes(json))
        ));
    }

    // Required overrides for ERC721Enumerable
    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
