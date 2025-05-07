// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract CosmosXMatrix {
    IERC20 public usdc;
    address public owner;
    uint256 public levelReserve;

    uint256[15] public slotPrices = [
        4e6, 5e6, 10e6, 20e6, 40e6, 80e6, 160e6, 320e6,
        640e6, 1280e6, 2560e6, 5120e6, 10240e6, 20480e6, 40960e6
    ];

    struct User {
        address referrer;
        address placementUpline;
        address left;
        address right;
        address[] directs;
        uint256 registeredAt;
        uint256 activeSlots;
        bool isFlipped;
        bool autoUpgrade;
        uint256 savedForUpgrade;
        bool exists;
    }

    struct Earnings {
        uint256 direct;
        uint256 upline;
        uint256 level;
        uint256 royalty;
        uint256 claimed;
    }

    mapping(address => User) public users;
    mapping(address => Earnings) public earnings;
    mapping(address => mapping(uint256 => bool)) public userSlots;
    mapping(uint256 => uint256) public royaltyPerSlot;

    event Registered(address indexed user, address indexed referrer);
    event SlotPurchased(address indexed user, uint256 slot);
    event Deactivated(address indexed user);
    event AutoUpgrade(address indexed user, uint256 newSlot);

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
        owner = msg.sender;

        users[msg.sender] = User({
            referrer: address(0),
            placementUpline:address(0),
            left: address(0),
            right: address(0),
            directs: new address[](0),
            registeredAt: block.timestamp,
            activeSlots: 15,
            isFlipped: false,
            autoUpgrade: false,
            savedForUpgrade: 0,
            exists: true
        });

        for (uint8 i = 1; i <= 15; i++) {
            userSlots[msg.sender][i] = true;
        }
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    function register(address _referrer) external {
        require(!users[msg.sender].exists, "User exists");
        require(users[_referrer].exists, "Invalid referrer");
        require(msg.sender != _referrer, "Cannot refer yourself");

        address placement = findFreePlacement(_referrer);

        users[msg.sender] = User({
            referrer: _referrer,
            placementUpline: placement,
            left: address(0),
            right: address(0),
            directs: new address[](0),
            registeredAt: block.timestamp,
            activeSlots: 0,
            isFlipped: false,
            autoUpgrade: false,
            savedForUpgrade: 0,
            exists: true
        });

        if (users[placement].left == address(0)) {
            users[placement].left = msg.sender;
        } else {
            users[placement].right = msg.sender;
        }

        users[_referrer].directs.push(msg.sender);
        emit Registered(msg.sender, placement);
    }

    function findFreePlacement(address start) public view returns (address) {
        address[5000] memory queue;
        uint256 head = 0;
        uint256 tail = 0;
        queue[tail++] = start;

        while (head < tail) {
            address current = queue[head++];
            if (users[current].left == address(0) || users[current].right == address(0)) {
                return current;
            }
            if (users[current].left != address(0)) queue[tail++] = users[current].left;
            if (users[current].right != address(0)) queue[tail++] = users[current].right;
        }

        revert("No free position");
    }

    function purchaseSlot(uint256 slot) external {
        require(slot >= 1 && slot <= 15, "Invalid slot");
        require(users[msg.sender].exists, "User not registered");

        uint256 totalCost = 0;
        for (uint256 i = 1; i <= slot; i++) {
            if (!userSlots[msg.sender][i]) {
                totalCost += slotPrices[i - 1];
            }
        }

        require(totalCost > 0, "All slots already purchased");
        usdc.transferFrom(msg.sender, address(this), totalCost);

        for (uint256 i = 1; i <= slot; i++) {
            if (!userSlots[msg.sender][i]) {
                userSlots[msg.sender][i] = true;
                users[msg.sender].activeSlots++;
                distributeIncome(msg.sender, i);
                emit SlotPurchased(msg.sender, i);
            }
        }
    }

    function distributeIncome(address user, uint256 slot) internal {
        uint256 amount = slotPrices[slot - 1];
        uint256 directShare;
        uint256 uplineShare;
        uint256 royaltyShare;
        uint256 levelShare = (amount * 15) / 100;

        if (slot == 1) {
            directShare = (amount * 70) / 100;
            royaltyShare = (amount * 15) / 100;
            address ref = users[user].referrer;
            if (ref != address(0)) {
                handleIncome(ref, directShare, "direct");
            }
        } else if (slot == 2) {
            royaltyShare = (amount * 15) / 100;
            uplineShare = (amount * 70) / 100;
            address secondUpline = getNthUpline(user, 2);
            if (secondUpline != address(0)) {
                handleIncome(secondUpline, uplineShare, "upline");
            }
        } else {
            directShare = (amount * 30) / 100;
            uplineShare = (amount * 30) / 100;
            royaltyShare = (amount * 25) / 100;
            address ref = users[user].referrer;
            if (ref != address(0)) {
                handleIncome(ref, directShare, "direct");
            }
            address nthUpline = getNthUpline(user, slot);
            if (nthUpline != address(0)) {
                handleIncome(nthUpline, uplineShare, "upline");
            }
        }

        address current = users[user].placementUpline;
        uint256 perLevel = levelShare / 15;
        uint256 distributed;
        for (uint8 i = 0; i < 15; i++) {
            if (current != address(0)) {
                handleIncome(current, perLevel, "level");
                distributed += perLevel;
                current = users[current].placementUpline;
            } else {
                break;
            }
        }
        // Save the unassigned portion as reserve
        uint256 leftover = levelShare - distributed;
        if (leftover > 0) {
            levelReserve += leftover;
        }

        royaltyPerSlot[slot] += royaltyShare;
    }

   function getNthUpline(address user, uint256 level) internal view returns (address) {
        address current = user;
        for (uint256 i = 0; i < level; i++) {
            if (current == address(0)) break;
            current = users[current].placementUpline;
        }
        return current;
    }


    function handleIncome(address user, uint256 amount, string memory incomeType) internal {
        if (keccak256(bytes(incomeType)) == keccak256("direct")) {
            earnings[user].direct += amount;
        } else if (keccak256(bytes(incomeType)) == keccak256("upline")) {
            earnings[user].upline += amount;
        } else if (keccak256(bytes(incomeType)) == keccak256("level")) {
            earnings[user].level += amount;
        } else if (keccak256(bytes(incomeType)) == keccak256("royalty")) {
            earnings[user].royalty += amount;
        }

        if (users[user].autoUpgrade) {
            users[user].savedForUpgrade += amount;
            tryAutoUpgrade(user);
        }
    }

    function tryAutoUpgrade(address user) internal {
        uint256 currentSlot = users[user].activeSlots;
        if (currentSlot >= 15) return;
        uint256 nextSlotPrice = slotPrices[currentSlot];
        if (users[user].savedForUpgrade >= nextSlotPrice) {
            users[user].savedForUpgrade -= nextSlotPrice;
            users[user].activeSlots++;
            userSlots[user][currentSlot + 1] = true;
            distributeIncome(user, currentSlot + 1);
            emit AutoUpgrade(user, currentSlot + 1);
        }
    }

    function claimEarnings() external {
        uint256 total = earnings[msg.sender].direct +
                        earnings[msg.sender].upline +
                        earnings[msg.sender].level +
                        earnings[msg.sender].royalty;
        require(total > 0, "Nothing to claim");

        earnings[msg.sender].claimed += total;
        earnings[msg.sender].direct = 0;
        earnings[msg.sender].upline = 0;
        earnings[msg.sender].level = 0;
        earnings[msg.sender].royalty = 0;

        usdc.transfer(msg.sender, total);
    }

    function checkUserActivation(address user) external {
        require(users[user].exists, "User not found");
        require(!users[user].isFlipped, "Already flipped");
        if (block.timestamp > users[user].registeredAt + 7 days) {
            if (users[user].directs.length < 2) {
                users[user].isFlipped = true;
                users[user].referrer = address(0);
                emit Deactivated(user);
            }
        }
    }

    function setAutoUpgrade(bool enabled) external {
        users[msg.sender].autoUpgrade = enabled;
    }

    function getEarningsBreakdown(address user) external view returns (
        uint256 direct,
        uint256 upline,
        uint256 level,
        uint256 royalty,
        uint256 claimed
    ) {
        Earnings memory e = earnings[user];
        return (e.direct, e.upline, e.level, e.royalty, e.claimed);
    }

    function distributeRoyalty(uint256 slot, address[] calldata usersList) external onlyOwner {
        uint256 total = royaltyPerSlot[slot];
        require(total > 0, "Nothing to distribute");
        uint256 share = total / usersList.length;

        for (uint256 i = 0; i < usersList.length; i++) {
            handleIncome(usersList[i], share, "royalty");
        }

        royaltyPerSlot[slot] = 0;
    }

    function transfer(address _receiver,uint256 amount) external onlyOwner {
        usdc.transfer(_receiver, amount);
    }

    function adminActivateSlot(address user, uint256 slot) external onlyOwner {
        require(user != address(0), "Invalid user");
        require(slot >= 1 && slot <= 15, "Invalid slot");
        // Ensure user hasn't already activated this slot
        require(!userSlots[user][slot], "Slot already active");
        // Mark slot as active
        userSlots[user][slot] = true;
        emit SlotPurchased(user, slot);
    }


    function getDirects(address user) external view returns (address[] memory) {
        return users[user].directs;
    }

    function getDirectLength(address user) external view returns (uint256 length) {
        return users[user].directs.length;
    }

    // Team Tree for UI (up to 3 levels)
    function getTeamTree(address user) external view returns (
        address left,
        address right,
        address leftLeft,
        address leftRight,
        address rightLeft,
        address rightRight
    ) {
        left = users[user].left;
        right = users[user].right;

        if (left != address(0)) {
            leftLeft = users[left].left;
            leftRight = users[left].right;
        }

        if (right != address(0)) {
            rightLeft = users[right].left;
            rightRight = users[right].right;
        }
    }

}