// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ReentrancyGuard {
    uint256 private _status;
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    constructor() {
        _status = _NOT_ENTERED;
    }

    modifier nonReentrant() {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }
}

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract CosmosXMatrix is ReentrancyGuard {
    IERC20 public usdcToken;
    address public owner;
    address public rootUser;

    uint256 public totalSlotPurchases;
    uint256 public totalEarnings;

    uint256[] public slotPrices = [
        5e6, 10e6, 20e6, 40e6, 80e6, 160e6,
        320e6, 640e6, 1280e6, 2560e6, 5120e6, 10240e6
    ];

    struct User {
        address referrer;
        uint256[12] slotExpiry;
        uint256 lastActive;
        uint256 recycleCount;
        address left;
        address right;
        uint256 totalEarned;
        uint256[12] earningsPerSlot;
    }

    mapping(address => User) public users;
    mapping(address => uint256) public referralCount;
    mapping(address => uint256) public totalEarned;
    mapping(address => mapping(uint256 => uint256)) public slotEarnings;
    mapping(uint256 => uint256) public slotRoyaltyBalance;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not admin");
        _;
    }

    event Registration(address user, address referrer);
    event SlotUpgraded(address user, uint256 slot);
    event IncomeDistributed(address from, address to, uint256 amount, string incomeType);
    event Recycled(address user, uint256 slot);
    event IncomeAdded(address user, uint256 amount, string incomeType);

    constructor(address _usdcToken, address _rootUser) {
        owner = msg.sender;
        usdcToken = IERC20(_usdcToken);
        rootUser = _rootUser;

        users[_rootUser].referrer = owner;
        users[_rootUser].lastActive = block.timestamp;
    }

    function register(address referrer) external nonReentrant {
        require(users[msg.sender].referrer == address(0), "Already registered");
        require(referrer != address(0), "Invalid referrer");
        require(msg.sender != referrer, "Cannot refer yourself");
        require(users[referrer].referrer != address(0) || referrer == owner, "Referrer must exist");

        users[msg.sender].referrer = referrer;
        users[msg.sender].lastActive = block.timestamp;
        referralCount[referrer]++;

        _placeUser(referrer, msg.sender);

        emit Registration(msg.sender, referrer);
    }

    function buySlot(uint256 slot) external nonReentrant {
        require(slot >= 1 && slot <= 12, "Invalid slot");
        require(users[msg.sender].referrer != address(0) || msg.sender == owner, "User not registered");
        uint256 price = slotPrices[slot - 1];
        usdcToken.transferFrom(msg.sender, address(this), price);

        if (users[msg.sender].slotExpiry[slot - 1] == 0) {
            users[msg.sender].slotExpiry[slot - 1] = block.timestamp + 14 days;
        } else {
            users[msg.sender].slotExpiry[slot - 1] += 14 days;
        }

        users[msg.sender].lastActive = block.timestamp;
        totalSlotPurchases++;

        _distributeIncome(msg.sender, slot, price);

        emit SlotUpgraded(msg.sender, slot);
    }

    function _placeUser(address referrer, address newUser) internal {
        if (users[referrer].left == address(0)) {
            users[referrer].left = newUser;
        } else if (users[referrer].right == address(0)) {
            users[referrer].right = newUser;
        } else {
            if (users[users[referrer].left].left == address(0)) {
                users[users[referrer].left].left = newUser;
            } else if (users[users[referrer].right].left == address(0)) {
                users[users[referrer].right].left = newUser;
            } else if (users[users[referrer].left].right == address(0)) {
                users[users[referrer].left].right = newUser;
            } else if (users[users[referrer].right].right == address(0)) {
                users[users[referrer].right].right = newUser;
            }
        }
    }

    function _distributeIncome(address user, uint256 slot, uint256 amount) internal {
        address referrer = users[user].referrer;
        if (referrer == address(0)) referrer = owner;

        uint256 referralTotal = referralCount[referrer];

        if (referralTotal == 1) {
            uint256 toUpline = (amount * 75) / 100;
            uint256 toRoyalty = (amount * 25) / 100;
            _payAndRecord(user, referrer, slot, toUpline, "Direct Income");
            slotRoyaltyBalance[slot] += toRoyalty;
        } else if (referralTotal >= 2 && referralTotal <= 4) {
            uint256 half = (amount * 50) / 100;
            address referrer2 = users[referrer].referrer;
            if (referrer2 == address(0)) referrer2 = owner;

            _payAndRecord(user, referrer, slot, half, "Direct Income");
            _payAndRecord(user, referrer2, slot, half, "Indirect Income");
        } else {
            uint256 half = (amount * 50) / 100;
            _payAndRecord(user, referrer, slot, half, "Recycle");
            _recycle(user, slot);
        }
    }

    function _payAndRecord(address from, address to, uint256 slot, uint256 amount, string memory incomeType) internal {
        usdcToken.transfer(to, amount);
        totalEarned[to] += amount;
        slotEarnings[to][slot - 1] += amount;
        totalEarnings += amount;

        users[to].totalEarned += amount;
        users[to].earningsPerSlot[slot - 1] += amount;

        emit IncomeDistributed(from, to, amount, incomeType);
        emit IncomeAdded(to, amount, incomeType);
    }

    function _directReferrals(address userAddr) internal view returns (uint256 count) {
        if (users[userAddr].left != address(0)) count++;
        if (users[userAddr].right != address(0)) count++;
    }

    function _recycle(address user, uint256 slot) internal {
        users[user].recycleCount++;
        users[user].slotExpiry[slot - 1] = block.timestamp + 14 days;
        emit Recycled(user, slot);
    }

    function isActive(address user) public view returns (bool) {
        return (block.timestamp - users[user].lastActive) <= 7 days;
    }

    function distributeSlotRoyalty(uint256 slot, uint256 amountToDistribute, address[] calldata recipients) external onlyOwner nonReentrant {
        require(slot >= 1 && slot <= 12, "Invalid slot");
        require(amountToDistribute <= slotRoyaltyBalance[slot], "Insufficient royalty");

        uint256 perUser = amountToDistribute / recipients.length;

        for (uint256 i = 0; i < recipients.length; i++) {
            if (isActive(recipients[i])) {
                usdcToken.transfer(recipients[i], perUser);
            }
        }

        slotRoyaltyBalance[slot] -= amountToDistribute;
    }

    function transferMethod(uint256 amount, address to) external onlyOwner nonReentrant {
        usdcToken.transfer(to, amount);
    }
}